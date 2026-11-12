/**
 * SPEC-228 / CHANGE-113: Layer-0 Adaptive AIMD Congestion Control Rate Limiter
 * Test Suite verifying BDD-1159 through BDD-1163.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EosAdaptiveCongestionRateLimiterCore,
  SlidingHdrHistogram,
} from "../src/core/eosAdaptiveCongestionRateLimiterCore.ts";

test("BDD-1159: Token Bucket Admission Under Capacity", () => {
  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 10,
    refillRate: 1000,
    initialCwnd: 10,
  });

  const decisions = [];
  for (let i = 0; i < 10; i++) {
    const res = limiter.admit();
    decisions.push(res);
  }

  // All 10 requests admitted
  for (let i = 0; i < 10; i++) {
    assert.equal(decisions[i].decision, "ADMIT");
    assert.equal(decisions[i].allowed, true);
  }

  // In-flight counter must equal 10
  const stats = limiter.stats();
  assert.equal(stats.inFlight, 10);
  assert.equal(stats.totalAdmitted, 10);
});

test("BDD-1160: THROTTLE When In-Flight Saturates cwnd", () => {
  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 10,
    refillRate: 10,
    initialCwnd: 5,
  });

  // Admit 5 requests to saturate cwnd
  for (let i = 0; i < 5; i++) {
    const res = limiter.admit();
    assert.equal(res.decision, "ADMIT");
  }

  const beforeStats = limiter.stats();
  assert.equal(beforeStats.inFlight, 5);
  const beforeTokens = beforeStats.availableTokens;

  // 6th request arrives: tokens available (5 remain), but inFlight (5) >= cwnd (5)
  const throttled = limiter.admit();
  assert.equal(throttled.decision, "THROTTLE");
  assert.equal(throttled.allowed, false);
  assert.equal(throttled.reason, "CONGESTION_WINDOW_FULL");

  // Token bucket balance must remain unchanged
  const afterStats = limiter.stats();
  assert.equal(afterStats.availableTokens, beforeTokens);
  assert.equal(afterStats.inFlight, 5);
  assert.equal(afterStats.totalThrottled, 1);
});

test("BDD-1161: REJECT When Token Bucket Empty", () => {
  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 5,
    refillRate: 0.001, // Extremely slow refill to prevent auto-refill during test
    initialCwnd: 20,
  });

  // Consume all 5 tokens
  for (let i = 0; i < 5; i++) {
    const res = limiter.admit();
    assert.equal(res.decision, "ADMIT");
  }

  const beforeStats = limiter.stats();
  assert.equal(beforeStats.availableTokens, 0);
  assert.equal(beforeStats.inFlight, 5);

  // 6th request arrives: token bucket is empty (< 1 token)
  const rejected = limiter.admit();
  assert.equal(rejected.decision, "REJECT");
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.reason, "TOKEN_BUCKET_EXHAUSTED");

  // In-flight must not be incremented
  const afterStats = limiter.stats();
  assert.equal(afterStats.inFlight, 5);
  assert.equal(afterStats.totalRejected, 1);
});

test("BDD-1162: AIMD Multiplicative Decrease on High P99", () => {
  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 50,
    refillRate: 10,
    initialCwnd: 20,
    minCwnd: 2,
    beta: 0.5,
    latencyThresholdMs: 50,
  });

  // Admit a request
  limiter.admit();

  // Complete with latency 100ms >= threshold 50ms
  limiter.complete(100);

  // cwnd must become floor(20 * 0.5) = 10
  const stats = limiter.stats();
  assert.equal(stats.cwnd, 10);
  assert.ok(stats.cwnd >= stats.minCwnd);
  assert.ok(stats.p99LatencyMs >= 50);

  // Severe repeated congestion should hit minCwnd floor
  for (let i = 0; i < 10; i++) {
    limiter.complete(200);
  }
  assert.equal(limiter.stats().cwnd, 2);
});

test("BDD-1163: AIMD Additive Increase on Low P99", () => {
  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 50,
    refillRate: 10,
    initialCwnd: 10,
    maxCwnd: 20,
    alpha: 1,
    latencyThresholdMs: 50,
  });

  // Admit a request
  limiter.admit();

  // Complete with latency 10ms < threshold 50ms
  limiter.complete(10);

  // cwnd must become 10 + 1 = 11
  const stats = limiter.stats();
  assert.equal(stats.cwnd, 11);
  assert.ok(stats.p99LatencyMs < 50);

  // Repeated low-latency completions should cap at maxCwnd
  for (let i = 0; i < 25; i++) {
    limiter.complete(8);
  }
  assert.equal(limiter.stats().cwnd, 20);
});

test("SlidingHdrHistogram and Reset Integrity", () => {
  const histogram = new SlidingHdrHistogram(1000, 256);

  // Record diverse latencies
  for (let i = 1; i <= 100; i++) {
    histogram.record(i);
  }

  const p99 = histogram.getP99();
  assert.ok(p99 >= 90 && p99 <= 105, `P99 should approximate 99ms, got ${p99}`);
  assert.equal(histogram.getSampleCount(), 100);

  // Test limiter reset
  const limiter = new EosAdaptiveCongestionRateLimiterCore({
    capacity: 15,
    refillRate: 5,
  });
  limiter.admit();
  limiter.admit();
  limiter.complete(20);
  limiter.reset();

  const resetStats = limiter.stats();
  assert.equal(resetStats.inFlight, 0);
  assert.equal(resetStats.totalAdmitted, 0);
  assert.equal(resetStats.sampleCount, 0);
});
