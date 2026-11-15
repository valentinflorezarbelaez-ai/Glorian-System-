/**
 * BDD-1491..BDD-1496: Rate Limiting & Traffic Shaping Governor Test Suite
 *
 * Validates Token Bucket replenishment, Leaky Bucket continuous drain,
 * multi-tier cascaded domain isolation, monotonic timing resilience,
 * RFC 6585 rate limit telemetry headers, and cryptographic receipts.
 *
 * Conforms to SPEC-286 / CHANGE-148.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { EosRateLimitingGovernor } from "../src/core/eosRateLimitingGovernor.ts";

test("BDD-1491: Token Bucket replenishment and burst capacity invariant", () => {
  const governor = new EosRateLimitingGovernor({
    test_tier: {
      algorithm: "token-bucket",
      burstCapacity: 10,
      refillRatePerSec: 5,
    },
  });

  const baseNs = 1_000_000_000_000n;

  // Consume all 10 burst tokens in instant succession
  for (let i = 0; i < 10; i++) {
    const decision = governor.evaluateSingle("test_tier", "client-a", 1, baseNs);
    assert.equal(decision.allowed, true);
    assert.equal(decision.remaining, 9 - i);
  }

  // 11th request at same instant should be rejected
  const rejected = governor.evaluateSingle("test_tier", "client-a", 1, baseNs);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.remaining, 0);
  assert.ok(rejected.retryAfterSec > 0);

  // Advance simulated monotonic time by 1.0 second (1e9 ns) -> 5 tokens replenished
  const futureNs = baseNs + 1_000_000_000n;
  const replenished = governor.evaluateSingle("test_tier", "client-a", 1, futureNs);
  assert.equal(replenished.allowed, true);
  assert.ok(replenished.remaining >= 3);
});

test("BDD-1492: Leaky Bucket continuous drain and buffer overflow protection", () => {
  const governor = new EosRateLimitingGovernor({
    queue_tier: {
      algorithm: "leaky-bucket",
      queueCapacity: 5,
      drainRatePerSec: 2,
    },
  });

  const baseNs = 2_000_000_000_000n;

  // Enqueue 5 drops
  for (let i = 0; i < 5; i++) {
    const decision = governor.evaluateSingle("queue_tier", "queue-1", 1, baseNs);
    assert.equal(decision.allowed, true);
  }

  // 6th drop should overflow queue buffer
  const overflow = governor.evaluateSingle("queue_tier", "queue-1", 1, baseNs);
  assert.equal(overflow.allowed, false);
  assert.ok(overflow.retryAfterSec > 0);

  // Advance time by 1.0 second -> 2 drops drained
  const drainedNs = baseNs + 1_000_000_000n;
  const retry = governor.evaluateSingle("queue_tier", "queue-1", 1, drainedNs);
  assert.equal(retry.allowed, true);
});

test("BDD-1493: Hierarchical cascaded domain isolation", () => {
  const governor = new EosRateLimitingGovernor({
    global: { algorithm: "token-bucket", burstCapacity: 100, refillRatePerSec: 10 },
    tenant: { algorithm: "token-bucket", burstCapacity: 10, refillRatePerSec: 2 },
    client: { algorithm: "token-bucket", burstCapacity: 3, refillRatePerSec: 1 },
  });

  const baseNs = 3_000_000_000_000n;

  // Client A issues 3 requests -> all pass
  for (let i = 0; i < 3; i++) {
    const dec = governor.evaluateHierarchy({ global: "global", tenant: "tenant-acme", client: "client-a" }, 1, baseNs);
    assert.equal(dec.allowed, true);
  }

  // Client A's 4th request must fail at client tier
  const decA4 = governor.evaluateHierarchy({ global: "global", tenant: "tenant-acme", client: "client-a" }, 1, baseNs);
  assert.equal(decA4.allowed, false);
  assert.equal(decA4.tier, "client");

  // Client B under same tenant should still have quota available
  const decB1 = governor.evaluateHierarchy({ global: "global", tenant: "tenant-acme", client: "client-b" }, 1, baseNs);
  assert.equal(decB1.allowed, true);
});

test("BDD-1494: Monotonic clock resilience against backward clock jumps", () => {
  const governor = new EosRateLimitingGovernor({
    safe_tier: { algorithm: "token-bucket", burstCapacity: 10, refillRatePerSec: 2 },
  });

  const t1 = 5_000_000_000_000n;
  const d1 = governor.evaluateSingle("safe_tier", "client-resilient", 3, t1);
  assert.equal(d1.allowed, true);
  assert.equal(d1.remaining, 7);

  // Backward clock step: t2 < t1 (e.g. NTP backwards adjustment)
  const t2 = 4_000_000_000_000n;
  const d2 = governor.evaluateSingle("safe_tier", "client-resilient", 1, t2);
  assert.equal(d2.allowed, true);
  assert.equal(d2.remaining, 6);
});

test("BDD-1495: RFC 6585 RateLimit header computation", () => {
  const governor = new EosRateLimitingGovernor({
    http_tier: { algorithm: "token-bucket", burstCapacity: 20, refillRatePerSec: 5 },
  });

  const decision = governor.evaluateSingle("http_tier", "api-client", 1);
  assert.ok(decision.headers);
  assert.equal(decision.headers["X-RateLimit-Limit"], "20");
  assert.equal(decision.headers["RateLimit-Limit"], "20");
  assert.ok(decision.headers["RateLimit-Remaining"]);
  assert.ok(decision.headers["RateLimit-Reset"]);
});

test("BDD-1496: Cryptographic audit receipt verification", async () => {
  const governor = new EosRateLimitingGovernor();
  const report = await governor.auditThroughput(100);

  assert.equal(report.totalEvaluations, 100);
  assert.ok(report.rejectionRate >= 0 && report.rejectionRate <= 1);
  assert.match(report.sha256Signature, /^[a-f0-9]{64}$/);

  const receiptPath = path.resolve(process.cwd(), "docs", "evidence", "RATE_LIMITER_RECEIPT.json");
  assert.ok(fs.existsSync(receiptPath));
  const rawReceipt = JSON.parse(fs.readFileSync(receiptPath, "utf-8"));
  assert.equal(rawReceipt.sha256Signature, report.sha256Signature);
});
