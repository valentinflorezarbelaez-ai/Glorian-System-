/**
 * EOS SYSTEM — ADAPTIVE CONCURRENCY LIMITER TESTS
 * Tests for EosAdaptiveConcurrencyLimiter (TCP Vegas / Little's Law)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosAdaptiveConcurrencyLimiter } from "../src/core/eosAdaptiveConcurrencyLimiter.ts";

test("default constructor sets correct defaults", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter();
  const metrics = limiter.getMetrics();
  assert.equal(metrics.currentLimit, 20);
  assert.equal(metrics.inFlight, 0);
  assert.equal(metrics.totalAdmitted, 0);
  assert.equal(metrics.totalShed, 0);
});

test("custom constructor options are applied", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({
    initialLimit: 10,
    minLimit: 2,
    maxLimit: 50,
    alpha: 5,
    beta: 10,
    smoothingFactor: 0.5,
  });
  const metrics = limiter.getMetrics();
  assert.equal(metrics.currentLimit, 10);
});

test("acquire grants token when under limit", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 5 });
  const result = limiter.acquire();
  assert.equal(result.granted, true);
  assert.ok(result.token?.startsWith("TKN-"));
  assert.equal(limiter.getMetrics().inFlight, 1);
  assert.equal(limiter.getMetrics().totalAdmitted, 1);
});

test("acquire rejects when at limit (load shedding)", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 2, minLimit: 2, maxLimit: 2 });
  limiter.acquire();
  limiter.acquire();
  const result = limiter.acquire();
  assert.equal(result.granted, false);
  assert.equal(result.reason, "SHED_LOAD_CONCURRENCY_EXCEEDED");
  assert.equal(limiter.getMetrics().totalShed, 1);
  assert.equal(limiter.getMetrics().inFlight, 2);
});

test("release decreases inFlight count", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 5 });
  limiter.acquire();
  limiter.acquire();
  assert.equal(limiter.getMetrics().inFlight, 2);
  limiter.release(10);
  assert.equal(limiter.getMetrics().inFlight, 1);
});

test("release updates RTT min and smoothed values", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 5, smoothingFactor: 0.5 });
  limiter.acquire();
  limiter.release(20);
  const m1 = limiter.getMetrics();
  assert.equal(m1.rttMinMs, 20);
  assert.equal(m1.rttSmoothedMs, 20);

  limiter.acquire();
  limiter.release(10);
  const m2 = limiter.getMetrics();
  assert.equal(m2.rttMinMs, 10);
  // EWMA: 0.5 * 10 + 0.5 * 20 = 15
  assert.equal(m2.rttSmoothedMs, 15);
});

test("release ignores negative RTT", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 5 });
  limiter.acquire();
  limiter.release(-1);
  const metrics = limiter.getMetrics();
  assert.equal(metrics.rttMinMs, 0);
  assert.equal(metrics.rttSmoothedMs, 0);
});

test("AIMD additive increase when queue inflation is low", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({
    initialLimit: 10,
    minLimit: 5,
    maxLimit: 50,
    alpha: 3,
    beta: 6,
    smoothingFactor: 0.2,
  });
  // Simulate low queue inflation scenario
  limiter.acquire();
  limiter.release(100); // rttMin=100, rttSmoothed=100
  limiter.acquire();
  limiter.release(102); // rttSmoothed = 0.2*102 + 0.8*100 = 100.4
  // queueInflation = 10 * (1 - 100/100.4) ≈ 0.4 < alpha(3) → increase
  const metrics = limiter.getMetrics();
  assert.ok(metrics.currentLimit >= 11, `limit should increase, got ${metrics.currentLimit}`);
});

test("AIMD multiplicative decrease when queue inflation is high", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({
    initialLimit: 50,
    minLimit: 5,
    maxLimit: 100,
    alpha: 3,
    beta: 6,
    smoothingFactor: 0.1,
  });
  // Set up high RTT baseline
  limiter.acquire();
  limiter.release(10);
  // Now send many high-latency releases to inflate RTT
  for (let i = 0; i < 20; i++) {
    limiter.acquire();
    limiter.release(200);
  }
  const metrics = limiter.getMetrics();
  assert.ok(metrics.currentLimit < 50, `limit should decrease, got ${metrics.currentLimit}`);
  assert.ok(metrics.currentLimit >= 5, `limit should not go below minLimit`);
});

test("limit respects maxLimit boundary", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({
    initialLimit: 49,
    minLimit: 5,
    maxLimit: 50,
    smoothingFactor: 0.5,
  });
  limiter.acquire();
  limiter.release(100);
  limiter.acquire();
  limiter.release(101);
  const metrics = limiter.getMetrics();
  assert.ok(metrics.currentLimit <= 50, `limit should not exceed maxLimit`);
});

test("limit respects minLimit boundary", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({
    initialLimit: 6,
    minLimit: 5,
    maxLimit: 50,
    smoothingFactor: 0.01,
  });
  limiter.acquire();
  limiter.release(10);
  for (let i = 0; i < 30; i++) {
    limiter.acquire();
    limiter.release(500);
  }
  const metrics = limiter.getMetrics();
  assert.ok(metrics.currentLimit >= 5, `limit should not go below minLimit`);
});

test("execute function under concurrency control", async () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 5 });
  const result = await limiter.execute(() => Promise.resolve(42));
  assert.equal(result.success, true);
  assert.equal(result.result, 42);
  assert.ok(result.rttMs !== undefined);
});

test("execute returns failure on shed load", async () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 1, minLimit: 1, maxLimit: 1 });
  limiter.acquire();
  const result = await limiter.execute(() => Promise.resolve(42));
  assert.equal(result.success, false);
  assert.equal(result.reason, "SHED_LOAD_CONCURRENCY_EXCEEDED");
});

test("execute handles throwing function", async () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 5 });
  const result = await limiter.execute(() => {
    throw new Error("boom");
  });
  assert.equal(result.success, false);
  assert.equal(result.reason, "Error: boom");
  assert.ok(result.rttMs !== undefined);
});

test("execute handles synchronous function", async () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 5 });
  const result = await limiter.execute(() => "sync result");
  assert.equal(result.success, true);
  assert.equal(result.result, "sync result");
});

test("getMetrics returns estimated queue size", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({
    initialLimit: 20,
    smoothingFactor: 0.5,
  });
  limiter.acquire();
  limiter.release(100);
  limiter.acquire();
  limiter.release(200);
  const metrics = limiter.getMetrics();
  assert.ok(metrics.estimatedQueueSize >= 0);
});

test("formatPrometheusMetrics returns valid Prometheus format", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 10, minLimit: 10, maxLimit: 10 });
  limiter.acquire();
  limiter.release(50);
  const promMetrics = limiter.formatPrometheusMetrics();
  assert.ok(promMetrics.includes("# HELP eos_concurrency_limit"));
  assert.ok(promMetrics.includes("# TYPE eos_concurrency_limit gauge"));
  assert.ok(promMetrics.includes("eos_concurrency_limit 10"));
  assert.ok(promMetrics.includes("eos_concurrency_inflight 0"));
  assert.ok(promMetrics.includes("eos_concurrency_shed_total 0"));
});

test("multiple acquire-release cycles track admitted and shed correctly", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 3, minLimit: 3, maxLimit: 3 });
  limiter.acquire();
  limiter.acquire();
  limiter.acquire();
  const shed1 = limiter.acquire();
  const shed2 = limiter.acquire();
  assert.equal(shed1.granted, false);
  assert.equal(shed2.granted, false);
  const metrics = limiter.getMetrics();
  assert.equal(metrics.totalAdmitted, 3);
  assert.equal(metrics.totalShed, 2);
});

test("estimated queue size is zero when no RTT data", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter();
  const metrics = limiter.getMetrics();
  assert.equal(metrics.estimatedQueueSize, 0);
  assert.equal(metrics.rttMinMs, 0);
});
