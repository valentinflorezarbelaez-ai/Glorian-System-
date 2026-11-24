/**
 * @file test/eosContinuousDynamicBatching.test.mjs
 * @description BDD test suite for SPEC-319 / CHANGE-181: Continuous Dynamic
 * Sequence Batching & Iteration-Level Request Scheduler.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosContinuousDynamicBatchingCore } from "../src/core/eosContinuousDynamicBatching.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("CONTINUOUS_DYNAMIC_BATCHING_RECEIPT.json", ROOT);

describe("SPEC-319: Continuous Dynamic Sequence Batching & Iteration-Level Request Scheduler", () => {
  test("BDD-1689: Request Enqueueing & Priority Management", () => {
    const scheduler = new EosContinuousDynamicBatchingCore({ maxBatchSize: 4 });

    const reqLow = scheduler.enqueue({ requestId: "req-low", maxTokens: 5, priority: "LOW" });
    const reqHigh = scheduler.enqueue({ requestId: "req-high", maxTokens: 5, priority: "HIGH" });
    const reqNorm = scheduler.enqueue({ requestId: "req-normal", maxTokens: 5, priority: "NORMAL" });

    assert.equal(reqLow.status, "PENDING");
    assert.equal(reqHigh.status, "PENDING");
    assert.equal(reqNorm.status, "PENDING");

    const queue = scheduler.getPendingQueue();
    assert.equal(queue.length, 3);
    // Strict priority ordering: HIGH -> NORMAL -> LOW
    assert.equal(queue[0].requestId, "req-high");
    assert.equal(queue[1].requestId, "req-normal");
    assert.equal(queue[2].requestId, "req-low");
  });

  test("BDD-1690: Continuous Dynamic Ingestion & Zero-Bubble Scheduling", () => {
    const scheduler = new EosContinuousDynamicBatchingCore({ maxBatchSize: 4 });

    // Initial 2 requests admitted
    scheduler.enqueue({ requestId: "req-1", maxTokens: 10 });
    scheduler.enqueue({ requestId: "req-2", maxTokens: 10 });
    scheduler.admitPending();

    assert.equal(scheduler.getActiveSlots().filter((s) => s.request !== null).length, 2);

    // 2 new requests arrive mid-flight
    scheduler.enqueue({ requestId: "req-3", maxTokens: 5 });
    scheduler.enqueue({ requestId: "req-4", maxTokens: 5 });

    // On next step, both new requests enter vacant slots immediately
    const stepRes = scheduler.step();

    assert.equal(stepRes.activeSlotCount, 4);
    assert.deepEqual(stepRes.admittedRequestIds.sort(), ["req-3", "req-4"]);
    assert.equal(scheduler.getPendingQueue().length, 0);
  });

  test("BDD-1691: Immediate Slot Eviction upon EOS Token Emission", () => {
    const scheduler = new EosContinuousDynamicBatchingCore({ maxBatchSize: 2, eosTokenId: 0 });

    // req-short will finish on iteration 1
    scheduler.enqueue({ requestId: "req-short", maxTokens: 1 });
    scheduler.enqueue({ requestId: "req-long", maxTokens: 5 });

    const step1 = scheduler.step();

    assert.equal(step1.step, 1);
    assert.deepEqual(step1.finishedRequestIds, ["req-short"]);
    assert.equal(scheduler.getCompletedRequests().length, 1);

    // Slot 0 was freed immediately; slot 1 still running
    const slots = scheduler.getActiveSlots();
    assert.equal(slots[0].request, null);
    assert.ok(slots[1].request !== null);
    assert.equal(slots[1].request.requestId, "req-long");
  });

  test("BDD-1692: Memory-Pressure Preemption and Re-Queueing", () => {
    // Limited blocks: 4 blocks total, 16 tokens/block
    const scheduler = new EosContinuousDynamicBatchingCore({
      maxBatchSize: 2,
      maxBlocksTotal: 4,
      tokensPerBlock: 4,
    });

    scheduler.enqueue({ requestId: "req-victim", promptTokens: [1, 2, 3, 4], maxTokens: 10, priority: "LOW" });
    scheduler.admitPending();

    const preemptedId = scheduler.preemptSlot(0);

    assert.equal(preemptedId, "req-victim");
    assert.equal(scheduler.getActiveSlots()[0].request, null);

    const queue = scheduler.getPendingQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].requestId, "req-victim");
    assert.equal(queue[0].status, "PREEMPTED");
    assert.equal(queue[0].preemptCount, 1);
  });

  test("BDD-1693: Heterogeneous Length Throughput & High Slot Utilization", () => {
    const scheduler = new EosContinuousDynamicBatchingCore({ maxBatchSize: 4 });

    // 8 requests with varied lengths: 2, 3, 2, 4, 1, 3, 2, 1
    const lengths = [2, 3, 2, 4, 1, 3, 2, 1];
    lengths.forEach((len, idx) => {
      scheduler.enqueue({ requestId: `req-hetero-${idx}`, maxTokens: len });
    });

    let totalSteps = 0;
    while (scheduler.getPendingQueue().length > 0 || scheduler.getActiveSlots().some((s) => s.request !== null)) {
      scheduler.step();
      totalSteps++;
    }

    const metrics = scheduler.getMetrics();
    assert.equal(metrics.completedRequestsCount, 8);
    assert.ok(totalSteps <= 7, `Total steps ${totalSteps} should be <= 7 due to continuous packing`);
    assert.ok(metrics.averageSlotUtilization > 0.65, `Slot utilization should exceed 65%`);
  });

  test("BDD-1694: Structural Invariant Audit & Cryptographic SHA-256 Receipt", () => {
    const scheduler = new EosContinuousDynamicBatchingCore({ maxBatchSize: 4 });
    const receipt = scheduler.audit(6);

    assert.equal(receipt.schemaVersion, "1.0.0");
    assert.equal(receipt.specRef, "SPEC-319");
    assert.equal(receipt.changeRef, "CHANGE-181");
    assert.equal(receipt.auditStatus, "VERIFIED");
    assert.ok(receipt.activeSlotsBounded);
    assert.ok(receipt.zeroPaddingDensityVerified);
    assert.ok(receipt.noSlotLeaksVerified);
    assert.ok(receipt.preemptionRecoveryVerified);
    assert.equal(receipt.sha256Receipt.length, 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
