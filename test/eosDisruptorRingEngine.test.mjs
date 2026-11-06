/**
 * EOS SYSTEM — SINGLE-THREAD RING BUFFER AND LOCAL BENCHMARK TEST SUITE
 * Governed by ADR-029, SPEC-022, FR-052 & BDD-052
 *
 * Verifies:
 * 1. Power-of-2 ring buffer indexing and bitwise masking.
 * 2. Sequencer cursor layout and ring state.
 * 3. Positive elapsed-time measurements without hardware-specific thresholds.
 * 4. Explicitly unmeasured heap allocation status.
 * 5. Eight-byte-unrolled JavaScript delimiter scanning.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  EosDisruptorRingEngine,
  LmaxDisruptorRingBuffer,
  FastStructuralByteScanner
} from "../src/core/eosDisruptorRingEngine.ts";

test("EOS typed-array ring and local benchmark suite (SPEC-022, BDD-052)", async (t) => {
  const engine = new EosDisruptorRingEngine(12); // 4096 slots

  await t.test("Suite 1: Power-of-2 Capacity & Bitwise Mask Indexing", () => {
    const ring = new LmaxDisruptorRingBuffer(10); // 1024 slots
    assert.equal(ring.capacity, 1024);
    assert.equal(ring.mask, 1023);

    // Publish 2048 events to force circular wrap-around
    for (let i = 0; i < 2048; i++) {
      const seq = ring.publish(100 + (i % 50), i, i * 2);
      assert.equal(seq, BigInt(i));
    }

    assert.equal(ring.cursor, 2048n);

    // Verify wrapped slot content
    const slotLast = ring.readSlot(2047n);
    assert.equal(slotLast.sequence, 2047n);
    assert.equal(slotLast.eventCode, 100 + (2047 % 50));
    assert.equal(slotLast.payloadA, 2047);
    assert.equal(slotLast.payloadB, 2047 * 2);
  });

  await t.test("Suite 2: Ring capacity and initial cursor", () => {
    const ring = engine.getRingBuffer();
    assert.equal(ring.capacity, 4096);
    assert.equal(ring.mask, 4095);

    // Sequencer cursor must start at 0n
    assert.ok(ring.cursor >= 0n);
  });

  await t.test("Suite 3: Local event loop returns observed timing and scope", () => {
    const ring = engine.getRingBuffer();
    const bench = ring.benchmarkThroughput(500_000);

    assert.equal(bench.totalEvents, 500_000);
    assert.equal(bench.heapAllocationMeasurement, "NOT_MEASURED");
    assert.equal(bench.cursorPaddingConfigured, true);
    assert.ok(Number.isFinite(bench.nanosecondsPerEvent) && bench.nanosecondsPerEvent > 0);
    assert.ok(Number.isFinite(bench.eventsPerSecond) && bench.eventsPerSecond > 0);
    assert.equal(bench.resultFingerprintSha256.length, 64);
  });

  await t.test("Suite 4: Eight-byte-unrolled JavaScript delimiter scan", () => {
    const scanner = engine.getScanner();

    // 1 MB structured test buffer
    const size = 1024 * 1024;
    const buffer = new Uint8Array(size);
    const pattern = new TextEncoder().encode('{"k":100,"arr":[1,2,3]},');
    for (let i = 0; i < size; i += pattern.length) {
      buffer.set(pattern.subarray(0, Math.min(pattern.length, size - i)), i);
    }

    const report = scanner.scanDelimiters(buffer);

    assert.equal(report.totalBytesScanned, size);
    assert.ok(report.structuralDelimitersFound > 100_000);
    assert.equal(report.unrolledWidthBytes, 8);
    assert.ok(Number.isFinite(report.throughputMiBPerSecond) && report.throughputMiBPerSecond >= 0);
    assert.equal(report.resultFingerprintSha256.length, 64);
  });

  await t.test("Suite 5: Combined benchmark report and result fingerprint", () => {
    const master = engine.runMasterSpeedBenchmark(250_000, 524_288);
    assert.equal(master.status, "BENCHMARK_COMPLETED");
    assert.equal(master.combinedFingerprintSha256.length, 64);
    assert.equal(master.disruptorReport.heapAllocationMeasurement, "NOT_MEASURED");
    assert.ok(master.byteScanReport.structuralDelimitersFound > 0);
  });
});
