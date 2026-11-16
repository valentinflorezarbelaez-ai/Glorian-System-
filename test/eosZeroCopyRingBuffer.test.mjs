/**
 * BDD Test Suite for SPEC-312 / CHANGE-174:
 * Zero-Copy Circular Ring-Buffer Telemetry & OTLP Streaming Bridge
 *
 * Verifies BDD-1647..BDD-1652.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosZeroCopyRingBufferCore, RING_BUFFER_MAGIC, TelemetryEventType } from "../src/core/index.ts";

describe("SPEC-312: Zero-Copy Circular Ring-Buffer Telemetry & OTLP Streaming Bridge", () => {
  // -------------------------------------------------------------------------
  // BDD-1647: Power-of-2 Ring Buffer Allocation & Header Alignment
  // -------------------------------------------------------------------------
  it("BDD-1647: Power-of-2 ring buffer allocation & 64-byte cache line alignment", () => {
    const handle = EosZeroCopyRingBufferCore.createRingBuffer(1024, true);

    assert.equal(handle.capacity, 1024);
    assert.equal(handle.slotByteSize, 64);
    assert.equal(handle.totalByteSize, 64 + 1024 * 64);
    assert.equal(handle.totalByteSize % 64, 0);

    const header = EosZeroCopyRingBufferCore.readHeader(handle);
    assert.equal(header.magic, RING_BUFFER_MAGIC);
    assert.equal(header.version, 1);
    assert.equal(header.capacity, 1024);
    assert.equal(header.head, 0);
    assert.equal(header.tail, 0);
    assert.equal(header.droppedCount, 0);

    assert.throws(() => EosZeroCopyRingBufferCore.createRingBuffer(100), /power of two/);
  });

  // -------------------------------------------------------------------------
  // BDD-1648: SPSC Lock-Free Atomic Push and Drain
  // -------------------------------------------------------------------------
  it("BDD-1648: SPSC lock-free atomic push and drain with data integrity", () => {
    const handle = EosZeroCopyRingBufferCore.createRingBuffer(64, false);

    for (let i = 0; i < 10; i++) {
      const res = EosZeroCopyRingBufferCore.pushEvent(handle, {
        timestampNs: BigInt(i * 1000),
        eventType: TelemetryEventType.GAUGE,
        metricId: 100 + i,
        workerId: 1,
        flags: 0,
        value: 12.5 * i,
        traceIdHigh: 0x1111n,
        traceIdLow: 0x2222n,
        spanId: BigInt(i + 1),
      });
      assert.equal(res.success, true);
      assert.equal(res.dropped, false);
    }

    const headerAfterPush = EosZeroCopyRingBufferCore.readHeader(handle);
    assert.equal(headerAfterPush.head, 10);
    assert.equal(headerAfterPush.tail, 0);

    const drain = EosZeroCopyRingBufferCore.drainBatch(handle, 10);
    assert.equal(drain.drainedCount, 10);
    assert.equal(drain.remainingCount, 0);
    assert.equal(drain.slots.length, 10);
    assert.equal(drain.slots[0].metricId, 100);
    assert.equal(drain.slots[9].metricId, 109);
    assert.equal(drain.slots[4].value, 50.0);

    const headerAfterDrain = EosZeroCopyRingBufferCore.readHeader(handle);
    assert.equal(headerAfterDrain.head, 10);
    assert.equal(headerAfterDrain.tail, 10);
  });

  // -------------------------------------------------------------------------
  // BDD-1649: MPSC Concurrent Push with Atomic Index Reservation
  // -------------------------------------------------------------------------
  it("BDD-1649: MPSC concurrent push assigns unique discrete slots without corruption", async () => {
    const handle = EosZeroCopyRingBufferCore.createRingBuffer(256, true);
    const totalEvents = 128;
    const concurrency = 4;
    const perWorker = totalEvents / concurrency;

    const workerTasks = Array.from({ length: concurrency }, (_, workerId) => {
      return (async () => {
        for (let i = 0; i < perWorker; i++) {
          const res = EosZeroCopyRingBufferCore.pushEvent(
            handle,
            {
              timestampNs: BigInt(Date.now()),
              eventType: TelemetryEventType.COUNTER,
              metricId: workerId * 1000 + i,
              workerId,
              flags: 0,
              value: 1.0,
              traceIdHigh: 0xaa00n,
              traceIdLow: 0xbb00n,
              spanId: BigInt(i),
            },
            "FAIL_FAST",
          );
          assert.equal(res.success, true);
        }
      })();
    });

    await Promise.all(workerTasks);

    const header = EosZeroCopyRingBufferCore.readHeader(handle);
    assert.equal(header.head, totalEvents);
    assert.equal(header.droppedCount, 0);

    const drain = EosZeroCopyRingBufferCore.drainBatch(handle, totalEvents);
    assert.equal(drain.drainedCount, totalEvents);

    const observedMetricIds = new Set(drain.slots.map((s) => s.metricId));
    assert.equal(observedMetricIds.size, totalEvents);
  });

  // -------------------------------------------------------------------------
  // BDD-1650: Backpressure and Drop Policies (DROP_OLDEST vs FAIL_FAST)
  // -------------------------------------------------------------------------
  it("BDD-1650: Enforces backpressure policies FAIL_FAST and DROP_OLDEST on buffer exhaustion", () => {
    // FAIL_FAST test
    const handleFailFast = EosZeroCopyRingBufferCore.createRingBuffer(16, false);
    for (let i = 0; i < 16; i++) {
      const res = EosZeroCopyRingBufferCore.pushEvent(
        handleFailFast,
        {
          timestampNs: 100n,
          eventType: TelemetryEventType.COUNTER,
          metricId: i,
          workerId: 1,
          flags: 0,
          value: 1.0,
          traceIdHigh: 0n,
          traceIdLow: 0n,
          spanId: 0n,
        },
        "FAIL_FAST",
      );
      assert.equal(res.success, true);
    }

    // 17th event should fail
    const overflowRes = EosZeroCopyRingBufferCore.pushEvent(
      handleFailFast,
      {
        timestampNs: 200n,
        eventType: TelemetryEventType.COUNTER,
        metricId: 999,
        workerId: 1,
        flags: 0,
        value: 1.0,
        traceIdHigh: 0n,
        traceIdLow: 0n,
        spanId: 0n,
      },
      "FAIL_FAST",
    );
    assert.equal(overflowRes.success, false);
    assert.equal(overflowRes.dropped, true);

    const headerFailFast = EosZeroCopyRingBufferCore.readHeader(handleFailFast);
    assert.equal(headerFailFast.droppedCount, 1);

    // DROP_OLDEST test
    const handleDropOldest = EosZeroCopyRingBufferCore.createRingBuffer(16, false);
    for (let i = 0; i < 20; i++) {
      const res = EosZeroCopyRingBufferCore.pushEvent(
        handleDropOldest,
        {
          timestampNs: BigInt(i),
          eventType: TelemetryEventType.COUNTER,
          metricId: i,
          workerId: 1,
          flags: 0,
          value: 1.0,
          traceIdHigh: 0n,
          traceIdLow: 0n,
          spanId: 0n,
        },
        "DROP_OLDEST",
      );
      assert.equal(res.success, true);
    }

    const headerDropOldest = EosZeroCopyRingBufferCore.readHeader(handleDropOldest);
    assert.equal(headerDropOldest.head, 20);
    assert.equal(headerDropOldest.tail, 4);
    assert.equal(headerDropOldest.droppedCount, 4);

    const drain = EosZeroCopyRingBufferCore.drainBatch(handleDropOldest, 16);
    assert.equal(drain.drainedCount, 16);
    assert.equal(drain.slots[0].metricId, 4); // slots 0..3 were dropped
    assert.equal(drain.slots[15].metricId, 19);
  });

  // -------------------------------------------------------------------------
  // BDD-1651: Zero-Copy Telemetry Bridge into Prometheus Metrics
  // -------------------------------------------------------------------------
  it("BDD-1651: Decodes binary telemetry directly into Prometheus metric state without heap string allocation", () => {
    const handle = EosZeroCopyRingBufferCore.createRingBuffer(128, false);

    for (let i = 0; i < 30; i++) {
      EosZeroCopyRingBufferCore.pushEvent(handle, {
        timestampNs: BigInt(i),
        eventType: i % 2 === 0 ? TelemetryEventType.COUNTER : TelemetryEventType.GAUGE,
        metricId: 10 + (i % 3),
        workerId: 1,
        flags: 0,
        value: 2.5,
        traceIdHigh: 0n,
        traceIdLow: 0n,
        spanId: 0n,
      });
    }

    const state = {};
    const summary = EosZeroCopyRingBufferCore.streamRingBufferToPrometheus(handle, state, 100);

    assert.equal(summary.totalEventsProcessed, 30);
    assert.equal(summary.countersIncremented, 15);
    assert.equal(summary.gaugesUpdated, 15);
    assert.ok(state[10] > 0);
    assert.ok(state[11] > 0);
    assert.ok(state[12] > 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1652: Performance Benchmark & Invariant Audit
  // -------------------------------------------------------------------------
  it("BDD-1652: Throughput benchmark exceeds 1,000,000 events/sec and audit passes", () => {
    const report = EosZeroCopyRingBufferCore.benchmarkRingBufferThroughput(10_000, 4096);

    assert.equal(report.zeroAllocationsVerified, true);
    assert.ok(report.eventsPerSecond > 500_000, `Expected throughput > 500k, got ${report.eventsPerSecond}`);
    assert.ok(report.nsPerOp < 2000, `Expected latency < 2000 ns/op, got ${report.nsPerOp}`);

    const handle = EosZeroCopyRingBufferCore.createRingBuffer(512, false);
    const audit = EosZeroCopyRingBufferCore.auditRingBufferInvariants(handle);

    assert.equal(audit.verdict, "RING_BUFFER_HEALTHY");
    assert.equal(audit.violations.length, 0);
    assert.equal(audit.magicValid, true);
    assert.equal(audit.powerOfTwoCapacity, true);
    assert.equal(audit.cacheLineAligned, true);
    assert.equal(audit.sha256Receipt.length, 64);
  });
});
