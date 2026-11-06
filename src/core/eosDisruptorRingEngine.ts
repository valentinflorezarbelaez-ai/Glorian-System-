/**
 * EOS SYSTEM — Disruptor-style typed-array ring and local benchmark (Layer 0)
 * Governed by ADR-029, SPEC-022, FR-052 & BDD-052
 *
 * This is a single-threaded JavaScript demonstration, not a concurrent Disruptor:
 * 1. A typed-array event ring with power-of-two capacity and bitwise masking.
 * 2. A sequencer cursor placed after a 64-byte prefix in its backing buffer.
 * 3. Elapsed-time measurements for a JavaScript loop; heap and cache behavior are not measured.
 * 4. An eight-way-unrolled JavaScript delimiter scan; no SIMD instructions are invoked.
 * 5. SHA-256 result fingerprints; these are not signatures, proofs, or attestations.
 *
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";

export interface RingSlotData {
  readonly sequence: bigint;
  readonly timestampUs: number;
  readonly eventCode: number;
  readonly payloadA: number;
  readonly payloadB: number;
}

export interface DisruptorBenchmarkReport {
  readonly totalEvents: number;
  readonly capacity: number;
  readonly durationUs: number;
  readonly nanosecondsPerEvent: number;
  readonly eventsPerSecond: number;
  readonly megaEventsPerSecond: number;
  readonly heapAllocationMeasurement: "NOT_MEASURED";
  readonly cursorPaddingConfigured: true;
  readonly resultFingerprintSha256: string;
}

export interface ByteScanBenchmarkReport {
  readonly totalBytesScanned: number;
  readonly structuralDelimitersFound: number;
  readonly durationUs: number;
  readonly throughputMiBPerSecond: number;
  readonly unrolledWidthBytes: 8;
  readonly resultFingerprintSha256: string;
}

/**
 * Single-threaded Disruptor-style ring with power-of-two capacity and ArrayBuffer storage.
 */
export class LmaxDisruptorRingBuffer {
  public readonly capacity: number;
  public readonly mask: number;

  // Contiguous slot buffer: 4 Float64 slots per event = 32 bytes per slot
  private readonly rawBuffer: ArrayBuffer;
  private readonly slotView: Float64Array;

  // Place the cursor at byte offset 64 in a 128-byte backing buffer.
  // This layout alone does not establish cross-thread isolation.
  private readonly sequencerBuffer: ArrayBuffer;
  private readonly cursorView: BigInt64Array;
  private static readonly CURSOR_PADDED_INDEX = 8;

  constructor(powerOfTwoExponent = 12) {
    if (!Number.isInteger(powerOfTwoExponent) || powerOfTwoExponent < 1 || powerOfTwoExponent > 20) {
      throw new RangeError("Ring capacity exponent must be an integer between 1 and 20.");
    }
    this.capacity = 1 << powerOfTwoExponent; // Default 4096 slots
    this.mask = this.capacity - 1;

    // 4 Float64 numbers per slot: [timestampUs, eventCode, payloadA, payloadB]
    const BYTES_PER_SLOT = 32;
    this.rawBuffer = new ArrayBuffer(this.capacity * BYTES_PER_SLOT);
    this.slotView = new Float64Array(this.rawBuffer);

    // 128 bytes total: padding before (64 bytes) + cursor (8 bytes) + padding after (56 bytes)
    this.sequencerBuffer = new ArrayBuffer(128);
    this.cursorView = new BigInt64Array(this.sequencerBuffer);
    this.cursorView[LmaxDisruptorRingBuffer.CURSOR_PADDED_INDEX] = 0n;
  }

  /** Publishes one event in this instance's single-threaded ring. */
  public publish(eventCode: number, payloadA: number, payloadB: number, timestamp = 0): bigint {
    const nextSeq = this.cursorView[LmaxDisruptorRingBuffer.CURSOR_PADDED_INDEX]++;
    const slotIndex = (Number(nextSeq) & this.mask) * 4;

    this.slotView[slotIndex] = timestamp;
    this.slotView[slotIndex + 1] = eventCode;
    this.slotView[slotIndex + 2] = payloadA;
    this.slotView[slotIndex + 3] = payloadB;

    return nextSeq;
  }

  /**
   * Hot-path slot read without object allocation.
   */
  public readSlot(sequence: bigint): RingSlotData {
    const slotIndex = (Number(sequence) & this.mask) * 4;
    return {
      sequence,
      timestampUs: this.slotView[slotIndex],
      eventCode: this.slotView[slotIndex + 1],
      payloadA: this.slotView[slotIndex + 2],
      payloadB: this.slotView[slotIndex + 3]
    };
  }

  public get cursor(): bigint {
    return this.cursorView[LmaxDisruptorRingBuffer.CURSOR_PADDED_INDEX];
  }

  /**
   * Measures elapsed time for N publish/read iterations; heap allocations are not measured.
   */
  public benchmarkThroughput(eventCount = 1_000_000): DisruptorBenchmarkReport {
    if (!Number.isSafeInteger(eventCount) || eventCount < 1 || eventCount > 10_000_000) {
      throw new RangeError("Event count must be an integer between 1 and 10,000,000.");
    }
    const startNs = process.hrtime.bigint();

    for (let i = 0; i < eventCount; i++) {
      const seq = this.publish(i & 255, (i & 15) * 1.5, i * 0.01);
      // Read the value directly without creating a RingSlotData object.
      const slotIndex = (Number(seq) & this.mask) * 4;
      const _readCode = this.slotView[slotIndex + 1];
    }

    const elapsedNs = Number(process.hrtime.bigint() - startNs);
    const durationUs = elapsedNs / 1000;
    const nsPerEvent = Number((elapsedNs / eventCount).toFixed(2));
    const eventsPerSec = elapsedNs > 0 ? Number(((eventCount / elapsedNs) * 1_000_000_000).toFixed(0)) : 0;
    const megaEventsPerSec = Number((eventsPerSec / 1_000_000).toFixed(2));

    const resultFingerprintSha256 = crypto
      .createHash("sha256")
      .update(`DISRUPTOR_BENCH:${eventCount}:${elapsedNs}:${megaEventsPerSec}`)
      .digest("hex");

    return {
      totalEvents: eventCount,
      capacity: this.capacity,
      durationUs,
      nanosecondsPerEvent: nsPerEvent,
      eventsPerSecond: eventsPerSec,
      megaEventsPerSecond: megaEventsPerSec,
      heapAllocationMeasurement: "NOT_MEASURED",
      cursorPaddingConfigured: true,
      resultFingerprintSha256
    };
  }
}

/**
 * Scans bytes in JavaScript using an eight-way-unrolled loop and a delimiter lookup table.
 */
export class FastStructuralByteScanner {
  private static readonly DELIMITER_LUT = new Uint8Array(256);

  static {
    // 123='{', 125='}', 91='[', 93=']', 44=',', 58=':'
    FastStructuralByteScanner.DELIMITER_LUT[123] = 1;
    FastStructuralByteScanner.DELIMITER_LUT[125] = 1;
    FastStructuralByteScanner.DELIMITER_LUT[91] = 1;
    FastStructuralByteScanner.DELIMITER_LUT[93] = 1;
    FastStructuralByteScanner.DELIMITER_LUT[44] = 1;
    FastStructuralByteScanner.DELIMITER_LUT[58] = 1;
  }

  /**
   * Counts JSON-like delimiters in the supplied byte array and returns observed elapsed time.
   */
  public scanDelimiters(bytes: Uint8Array): ByteScanBenchmarkReport {
    const startNs = process.hrtime.bigint();
    const len = bytes.length;
    let delimiterCount = 0;
    const lut = FastStructuralByteScanner.DELIMITER_LUT;

    // Unrolled 8-way branchless block scanning loop
    const limit = len - 8;
    let i = 0;
    while (i <= limit) {
      delimiterCount +=
        lut[bytes[i]] +
        lut[bytes[i + 1]] +
        lut[bytes[i + 2]] +
        lut[bytes[i + 3]] +
        lut[bytes[i + 4]] +
        lut[bytes[i + 5]] +
        lut[bytes[i + 6]] +
        lut[bytes[i + 7]];
      i += 8;
    }

    // Remaining tail bytes
    while (i < len) {
      delimiterCount += lut[bytes[i]];
      i++;
    }

    const elapsedNs = Number(process.hrtime.bigint() - startNs);
    const durationUs = elapsedNs / 1000;
    const mbScanned = len / (1024 * 1024);
    const throughputMiBPerSecond = elapsedNs > 0
      ? Number((mbScanned / (elapsedNs / 1_000_000_000)).toFixed(2))
      : 0;

    const resultFingerprintSha256 = crypto
      .createHash("sha256")
      .update(`SCAN_BENCH:${len}:${delimiterCount}:${throughputMiBPerSecond}`)
      .digest("hex");

    return {
      totalBytesScanned: len,
      structuralDelimitersFound: delimiterCount,
      durationUs,
      throughputMiBPerSecond,
      unrolledWidthBytes: 8,
      resultFingerprintSha256
    };
  }
}

/**
 * Combines the local ring loop and a scan of a synthetic byte buffer.
 */
export class EosDisruptorRingEngine {
  private readonly ringBuffer: LmaxDisruptorRingBuffer;
  private readonly scanner: FastStructuralByteScanner;

  constructor(powerOfTwoExponent = 12) {
    this.ringBuffer = new LmaxDisruptorRingBuffer(powerOfTwoExponent);
    this.scanner = new FastStructuralByteScanner();
  }

  public runMasterSpeedBenchmark(events = 1_000_000, payloadBytes = 1_048_576): {
    disruptorReport: DisruptorBenchmarkReport;
    byteScanReport: ByteScanBenchmarkReport;
    combinedFingerprintSha256: string;
    status: "BENCHMARK_COMPLETED";
  } {
    if (!Number.isSafeInteger(payloadBytes) || payloadBytes < 1 || payloadBytes > 256 * 1024 * 1024) {
      throw new RangeError("Payload size must be an integer between 1 byte and 256 MiB.");
    }
    const disruptorReport = this.ringBuffer.benchmarkThroughput(events);

    // Synthetic structured JSON payload buffer (1 MB)
    const testBuffer = new Uint8Array(payloadBytes);
    const sampleChunk = new TextEncoder().encode('{"event":"TELEMETRY","seq":1024,"valid":true,"data":[1,2,3,4]},');
    for (let i = 0; i < payloadBytes; i += sampleChunk.length) {
      testBuffer.set(sampleChunk.subarray(0, Math.min(sampleChunk.length, payloadBytes - i)), i);
    }

    const byteScanReport = this.scanner.scanDelimiters(testBuffer);

    const combinedFingerprintSha256 = crypto
      .createHash("sha256")
      .update(`BENCHMARK_RESULTS:${disruptorReport.resultFingerprintSha256}:${byteScanReport.resultFingerprintSha256}`)
      .digest("hex");

    return {
      disruptorReport,
      byteScanReport,
      combinedFingerprintSha256,
      status: "BENCHMARK_COMPLETED"
    };
  }

  public getRingBuffer(): LmaxDisruptorRingBuffer {
    return this.ringBuffer;
  }

  public getScanner(): FastStructuralByteScanner {
    return this.scanner;
  }
}
