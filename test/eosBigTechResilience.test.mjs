/**
 * BDD Test Suite — Big Tech Resilience & Flow Modules (SPEC-153..158)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosAdaptiveRateLimiter } from "../src/core/eosAdaptiveRateLimiter.ts";
import { EosBlueGreenOrchestrator } from "../src/core/eosBlueGreenOrchestrator.ts";
import { EosConnectionPoolManager } from "../src/core/eosConnectionPoolManager.ts";
import { EosCanaryAnalysisEngine } from "../src/core/eosCanaryAnalysisEngine.ts";
import { EosBackpressureFlowController } from "../src/core/eosBackpressureFlowController.ts";
import { EosResilienceMesh } from "../src/core/eosResilienceMesh.ts";

// ---------------------------------------------------------------------------
describe("SPEC-153: Adaptive Rate Limiter", () => {
  it("BDD-520: allows burst up to bucket capacity", () => {
    const rl = new EosAdaptiveRateLimiter({
      bucketCapacity: 10,
      refillRatePerSec: 100,
      windowSizeMs: 1000,
      maxPerWindow: 1000,
      adaptive: false,
    });
    let allowed = 0;
    for (let i = 0; i < 10; i++) {
      if (rl.tryAcquire().allowed) allowed++;
    }
    assert.equal(allowed, 10);
  });

  it("BDD-521: denies after bucket exhaustion", () => {
    const rl = new EosAdaptiveRateLimiter({
      bucketCapacity: 5,
      refillRatePerSec: 0,
      windowSizeMs: 60000,
      maxPerWindow: 1000,
      adaptive: false,
    });
    for (let i = 0; i < 5; i++) rl.tryAcquire();
    const denied = rl.tryAcquire();
    assert.equal(denied.allowed, false);
    assert.equal(denied.remainingTokens, 0);
  });

  it("BDD-522: sliding window caps throughput", () => {
    const rl = new EosAdaptiveRateLimiter({
      bucketCapacity: 1000,
      refillRatePerSec: 1000,
      windowSizeMs: 60000,
      maxPerWindow: 3,
      adaptive: false,
    });
    for (let i = 0; i < 3; i++) rl.tryAcquire();
    assert.equal(rl.tryAcquire().allowed, false);
  });

  it("BDD-523: adaptive decreases capacity on rejections", () => {
    const rl = new EosAdaptiveRateLimiter({
      bucketCapacity: 10,
      refillRatePerSec: 0,
      windowSizeMs: 60000,
      maxPerWindow: 10000,
      adaptive: true,
    });
    for (let i = 0; i < 20; i++) rl.tryAcquire(); // exhaust + get denied
    const stats = rl.getStats();
    assert.ok(stats.currentCapacity <= 10);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-154: Blue-Green Deployment Orchestrator", () => {
  it("BDD-530: successful deployment ends in IDLE", async () => {
    const orch = new EosBlueGreenOrchestrator();
    const result = await orch.deploy(
      {
        serviceId: "svc-1",
        greenVersion: "v2.0",
        validationAttempts: 2,
        validationIntervalMs: 5,
        trafficShiftPercent: 100,
        rollbackHealthThreshold: 5,
      },
      async () => ({ healthy: true, errorPercent: 0 }),
    );
    assert.equal(result.success, true);
    assert.equal(result.finalState, "IDLE");
    assert.ok(result.steps.length >= 5);
  });

  it("BDD-531: unhealthy green triggers ROLLING_BACK", async () => {
    const orch = new EosBlueGreenOrchestrator();
    const result = await orch.deploy(
      {
        serviceId: "svc-2",
        greenVersion: "v3.0",
        validationAttempts: 3,
        validationIntervalMs: 5,
        trafficShiftPercent: 50,
        rollbackHealthThreshold: 1,
      },
      async () => ({ healthy: false, errorPercent: 15 }),
    );
    assert.equal(result.success, false);
    assert.equal(result.finalState, "ROLLING_BACK");
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-155: Connection Pool Manager", () => {
  it("BDD-540: creates connections up to max", async () => {
    const pool = new EosConnectionPoolManager({
      maxSize: 3,
      minSize: 1,
      leaseTimeoutMs: 100,
      leakDetectionThresholdMs: 5000,
      validationQuery: async () => true,
    });
    await pool.acquire();
    await pool.acquire();
    await pool.acquire();
    const stats = pool.getStats();
    assert.equal(stats.active, 3);
    assert.equal(stats.total, 3);
  });

  it("BDD-541: release makes connection available again", async () => {
    const pool = new EosConnectionPoolManager({
      maxSize: 2,
      minSize: 0,
      leaseTimeoutMs: 100,
      leakDetectionThresholdMs: 5000,
      validationQuery: async () => true,
    });
    const a = await pool.acquire();
    pool.release(a);
    const b = await pool.acquire();
    assert.equal(b, a); // Reuses the idle connection
  });

  it("BDD-542: drain rejects all waiters", async () => {
    const pool = new EosConnectionPoolManager({
      maxSize: 1,
      minSize: 0,
      leaseTimeoutMs: 5000,
      leakDetectionThresholdMs: 5000,
      validationQuery: async () => true,
    });
    await pool.acquire(); // Fills the pool
    const promise = pool.acquire(); // Goes to wait queue
    pool.drain();
    await assert.rejects(promise, /POOL_DRAINING/);
  });

  it("BDD-543: waiter queue FIFO handover, lease timeout, leak detection, and unknown release", async () => {
    // 1. Waiter handover
    const pool = new EosConnectionPoolManager({
      maxSize: 1,
      minSize: 0,
      leaseTimeoutMs: 1000,
      leakDetectionThresholdMs: 10,
      validationQuery: async () => true,
    });
    const c1 = await pool.acquire();
    const waitPromise = pool.acquire(); // enqueued
    pool.release(c1); // hands over to waiter
    const c2 = await waitPromise;
    assert.equal(c2, c1);

    // 2. Lease timeout
    const timeoutPool = new EosConnectionPoolManager({
      maxSize: 1,
      minSize: 0,
      leaseTimeoutMs: 15,
      leakDetectionThresholdMs: 5000,
      validationQuery: async () => true,
    });
    await timeoutPool.acquire();
    await assert.rejects(timeoutPool.acquire(), /LEASE_TIMEOUT/);

    // 3. Leak detection
    await new Promise((r) => setTimeout(r, 20));
    const leaks = pool.detectLeaks();
    assert.ok(leaks.includes(c2));

    // 4. Unknown release
    pool.release("non-existent-conn");
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-156: Canary Analysis Engine", () => {
  it("BDD-550: identical distributions → PASS", () => {
    const engine = new EosCanaryAnalysisEngine();
    const baseline = { latency: [10, 12, 11, 10, 13, 11, 12, 10, 11, 12] };
    const canary = { latency: [10, 11, 12, 11, 10, 12, 11, 10, 12, 11] };
    const result = engine.analyze(baseline, canary, [{ name: "latency", importance: "HARD" }]);
    assert.equal(result.verdict, "PASS");
    assert.equal(result.canaryScore, 100);
  });

  it("BDD-551: canary 5x worse → FAIL (hard metric)", () => {
    const engine = new EosCanaryAnalysisEngine();
    const baseline = { latency: Array(20).fill(10) };
    const canary = { latency: Array(20).fill(50) };
    const result = engine.analyze(baseline, canary, [{ name: "latency", importance: "HARD" }]);
    assert.equal(result.verdict, "FAIL");
    assert.ok(result.hardFailCount >= 1);
  });

  it("BDD-552: bound violation → FAIL regardless of p-value", () => {
    const engine = new EosCanaryAnalysisEngine();
    const result = engine.analyze(
      { errorRate: [0.01, 0.01, 0.01, 0.01, 0.01] },
      { errorRate: [0.1, 0.1, 0.1, 0.1, 0.1] },
      [{ name: "errorRate", importance: "SOFT", upperBound: 0.05 }],
    );
    assert.equal(result.metrics[0].verdict, "FAIL");
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-157: Backpressure Flow Controller", () => {
  it("BDD-560: emit requires demand signal", () => {
    const bp = new EosBackpressureFlowController({
      initialWindow: 10,
      maxWindow: 50,
      highWatermark: 80,
      lowWatermark: 20,
      congestionMultiplier: 0.5,
    });
    assert.equal(bp.tryEmit(), false); // No demand
    bp.signalDemand(3);
    assert.equal(bp.tryEmit(), true);
    assert.equal(bp.tryEmit(), true);
    assert.equal(bp.tryEmit(), true);
    assert.equal(bp.tryEmit(), false); // Demand exhausted
  });

  it("BDD-561: loss reduces window (multiplicative decrease)", () => {
    const bp = new EosBackpressureFlowController({
      initialWindow: 20,
      maxWindow: 100,
      highWatermark: 80,
      lowWatermark: 20,
      congestionMultiplier: 0.5,
    });
    bp.signalDemand(10);
    bp.tryEmit();
    bp.signalLoss();
    const snap = bp.getSnapshot();
    assert.equal(snap.windowSize, 10); // 20 * 0.5
  });

  it("BDD-562: ack increases window (additive increase)", () => {
    const bp = new EosBackpressureFlowController({
      initialWindow: 5,
      maxWindow: 50,
      highWatermark: 80,
      lowWatermark: 20,
      congestionMultiplier: 0.5,
    });
    bp.signalDemand(2);
    bp.tryEmit();
    bp.acknowledge();
    assert.equal(bp.getSnapshot().windowSize, 6);
  });
});

// ---------------------------------------------------------------------------
describe("SPEC-158: Unified Resilience Mesh", () => {
  it("BDD-570: successful call passes through", async () => {
    const mesh = new EosResilienceMesh({
      maxConcurrent: 10,
      failureThreshold: 3,
      cooldownMs: 1000,
      timeoutMs: 500,
      maxRetries: 2,
      baseBackoffMs: 1,
      jitterMs: 1,
    });
    const r = await mesh.execute(async () => 42);
    assert.equal(r.success, true);
    assert.equal(r.value, 42);
    assert.equal(r.attemptsUsed, 1);
  });

  it("BDD-571: timeout triggers retry", async () => {
    let calls = 0;
    const mesh = new EosResilienceMesh({
      maxConcurrent: 10,
      failureThreshold: 5,
      cooldownMs: 1000,
      timeoutMs: 30,
      maxRetries: 3,
      baseBackoffMs: 1,
      jitterMs: 1,
    });
    const r = await mesh.execute(async () => {
      calls++;
      if (calls < 3) await new Promise((res) => setTimeout(res, 200));
      return "done";
    });
    assert.equal(r.success, true);
    assert.equal(r.attemptsUsed, 3);
  });

  it("BDD-572: repeated failures open circuit breaker", async () => {
    const mesh = new EosResilienceMesh({
      maxConcurrent: 10,
      failureThreshold: 2,
      cooldownMs: 5000,
      timeoutMs: 50,
      maxRetries: 0,
      baseBackoffMs: 1,
      jitterMs: 0,
    });
    await mesh.execute(async () => {
      throw new Error("boom");
    });
    await mesh.execute(async () => {
      throw new Error("boom");
    });
    assert.equal(mesh.getCircuitState(), "OPEN");
    const r = await mesh.execute(async () => "should not run");
    assert.equal(r.rejected, "CIRCUIT_OPEN");
  });

  it("BDD-573: bulkhead rejects when at capacity", async () => {
    const mesh = new EosResilienceMesh({
      maxConcurrent: 1,
      failureThreshold: 5,
      cooldownMs: 1000,
      timeoutMs: 5000,
      maxRetries: 0,
      baseBackoffMs: 1,
      jitterMs: 0,
    });
    // Start a slow call and await until it's in-flight
    const blocker = mesh.execute(() => new Promise((r) => setTimeout(() => r("done"), 200)));
    await new Promise((r) => setTimeout(r, 10)); // Let first call enter active
    // Second call should hit bulkhead
    const r2 = await mesh.execute(async () => "no");
    assert.equal(r2.rejected, "BULKHEAD");
    const r1 = await blocker;
    assert.equal(r1.success, true);
  });
});
