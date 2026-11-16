/**
 * Glorian System — Zero-Copy Circular Ring-Buffer Types
 * Governed by SPEC-312 / CHANGE-174
 *
 * Mechanical-sympathy lock-free ring buffer sequencers and binary telemetry framing.
 * Zero external runtime dependencies. Strict 800-line ceiling (SPEC-250).
 */

export const RING_BUFFER_MAGIC = 0x454f5352; // "EOSR"
export const RING_BUFFER_VERSION = 1;
export const RING_BUFFER_HEADER_BYTES = 64; // Cache-line aligned header
export const RING_BUFFER_SLOT_BYTES = 64; // Cache-line aligned 64-byte slot

export const TelemetryEventType = {
  GAUGE: 1,
  COUNTER: 2,
  SPAN: 3,
  LOG: 4,
} as const;

export type TelemetryEventType = (typeof TelemetryEventType)[keyof typeof TelemetryEventType];

export type BackpressurePolicy = "DROP_OLDEST" | "FAIL_FAST";

export interface RingBufferHeader {
  readonly magic: number;
  readonly version: number;
  readonly capacity: number;
  readonly slotByteSize: number;
  readonly head: number;
  readonly tail: number;
  readonly droppedCount: number;
  readonly flags: number;
}

export interface RingBufferTelemetrySlot {
  readonly timestampNs: bigint;
  readonly eventType: TelemetryEventType | number;
  readonly metricId: number;
  readonly workerId: number;
  readonly flags: number;
  readonly value: number;
  readonly traceIdHigh: bigint;
  readonly traceIdLow: bigint;
  readonly spanId: bigint;
}

export interface PushResult {
  readonly success: boolean;
  readonly slotIndex: number;
  readonly dropped: boolean;
  readonly head: number;
  readonly tail: number;
}

export interface DrainBatchResult {
  readonly drainedCount: number;
  readonly slots: readonly RingBufferTelemetrySlot[];
  readonly remainingCount: number;
}

export interface ZeroCopyRingBufferHandle {
  readonly buffer: ArrayBufferLike;
  readonly headerView: Int32Array;
  readonly uint32HeaderView: Uint32Array;
  readonly dataView: DataView;
  readonly capacity: number;
  readonly slotByteSize: number;
  readonly totalByteSize: number;
  readonly isShared: boolean;
}

export interface RingBufferBenchmarkReport {
  readonly iterations: number;
  readonly capacity: number;
  readonly totalElapsedMs: number;
  readonly eventsPerSecond: number;
  readonly nsPerOp: number;
  readonly droppedCount: number;
  readonly zeroAllocationsVerified: boolean;
}

export interface RingBufferAuditReport {
  readonly verdict: "RING_BUFFER_HEALTHY" | "RING_BUFFER_BREACH";
  readonly magicValid: boolean;
  readonly powerOfTwoCapacity: boolean;
  readonly cacheLineAligned: boolean;
  readonly invariantsChecked: number;
  readonly violations: readonly string[];
  readonly head: number;
  readonly tail: number;
  readonly dropped: number;
  readonly sha256Receipt: string;
}

export interface PrometheusStreamingSummary {
  readonly totalEventsProcessed: number;
  readonly gaugesUpdated: number;
  readonly countersIncremented: number;
  readonly spansRecorded: number;
  readonly logsRecorded: number;
  readonly latestMetricValues: Record<number, number>;
}
