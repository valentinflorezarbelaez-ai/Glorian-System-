/**
 * Glorian System — Chaos Engineering & Circuit Breaker Test Suite
 * Governed by SPEC-279 / CHANGE-141
 *
 * Verifies BDD-1449 through BDD-1454.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";

import { EosChaosCircuitBreaker } from "../src/core/eosChaosCircuitBreaker.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const POLICY_PATH = path.join(ROOT, "templates/chaos/glorian-resilience-policy.json");

describe("SPEC-279: Chaos Engineering & Circuit Breaker Fault Injection Gateway", () => {
  // -------------------------------------------------------------------------
  // BDD-1449: Nominal Operation & State Preservation in CLOSED State
  // -------------------------------------------------------------------------
  it("BDD-1449: preserves CLOSED state and tracks successful executions under nominal conditions", async () => {
    const breaker = new EosChaosCircuitBreaker("user-service", {
      slidingWindowSize: 10,
      minimumNumberOfCalls: 5,
      failureRateThreshold: 50.0,
    });

    for (let i = 0; i < 5; i++) {
      const res = await breaker.execute(() => `RESULT_${i}`);
      assert.equal(res, `RESULT_${i}`);
    }

    const metrics = breaker.getMetrics();
    assert.equal(metrics.state, "CLOSED");
    assert.equal(metrics.totalCalls, 5);
    assert.equal(metrics.successfulCalls, 5);
    assert.equal(metrics.failedCalls, 0);
    assert.equal(metrics.failureRate, 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1450: Automatic Circuit Tripping to OPEN on Failure Rate Threshold
  // -------------------------------------------------------------------------
  it("BDD-1450: automatically transitions to OPEN when failure rate exceeds configured threshold", async () => {
    const breaker = new EosChaosCircuitBreaker("inventory-service", {
      slidingWindowSize: 5,
      minimumNumberOfCalls: 5,
      failureRateThreshold: 50.0,
    });

    // 2 successes, 3 failures -> 60% failure rate >= 50%
    await breaker.execute(() => "OK-1");
    await breaker.execute(() => "OK-2");

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(() => {
          throw new Error("DB_TIMEOUT");
        });
      } catch (err) {
        assert.equal(err.message, "DB_TIMEOUT");
      }
    }

    assert.equal(breaker.getState(), "OPEN");
    const metrics = breaker.getMetrics();
    assert.equal(metrics.state, "OPEN");
    assert.equal(metrics.failedCalls, 3);
    assert.equal(metrics.failureRate, 60.0);
  });

  // -------------------------------------------------------------------------
  // BDD-1451: Immediate Call Rejection or Fallback Execution in OPEN State
  // -------------------------------------------------------------------------
  it("BDD-1451: fast-fails with CIRCUIT_BREAKER_OPEN or executes graceful fallback in OPEN state", async () => {
    const breaker = new EosChaosCircuitBreaker("auth-service", {
      waitDurationInOpenStateMs: 60000, // Long wait to remain OPEN
    });

    breaker.forceOpen();
    assert.equal(breaker.getState(), "OPEN");

    // Without fallback -> throws
    await assert.rejects(async () => breaker.execute(() => "SHOULD_NOT_EXECUTE"), { message: /CIRCUIT_BREAKER_OPEN/ });

    // With fallback -> returns fallback value
    const fallbackRes = await breaker.execute(
      () => "NORMAL_VALUE",
      (err) => `DEGRADED_CACHED_VALUE: ${err.message}`,
    );
    assert.ok(fallbackRes.startsWith("DEGRADED_CACHED_VALUE"));
    assert.equal(breaker.getMetrics().rejectedCalls, 2);
  });

  // -------------------------------------------------------------------------
  // BDD-1452: Timed Transition to HALF_OPEN and Self-Healing Recovery
  // -------------------------------------------------------------------------
  it("BDD-1452: transitions to HALF_OPEN after wait timeout and self-heals back to CLOSED", async () => {
    const breaker = new EosChaosCircuitBreaker("catalog-service", {
      waitDurationInOpenStateMs: 50, // Short duration for test
      permittedNumberOfCallsInHalfOpenState: 2,
    });

    breaker.forceOpen();
    assert.equal(breaker.getState(), "OPEN");

    // Wait for open duration to elapse
    await new Promise((r) => setTimeout(r, 60));

    // Next call triggers transition to HALF_OPEN
    assert.equal(breaker.getState(), "HALF_OPEN");

    // Execute 2 successful probe calls to satisfy permittedNumberOfCallsInHalfOpenState
    const res1 = await breaker.execute(() => "PROBE_1");
    assert.equal(res1, "PROBE_1");

    const res2 = await breaker.execute(() => "PROBE_2");
    assert.equal(res2, "PROBE_2");

    // State self-heals to CLOSED
    assert.equal(breaker.getState(), "CLOSED");
  });

  // -------------------------------------------------------------------------
  // BDD-1453: Controlled Chaos Latency & Error Injection with Blast Radius Enforcement
  // -------------------------------------------------------------------------
  it("BDD-1453: injects synthetic faults only into matching scoped targets respecting blast radius", async () => {
    assert.ok(fs.existsSync(POLICY_PATH), "Chaos policy template must exist");
    const breaker = new EosChaosCircuitBreaker("payment-api", {
      slidingWindowSize: 10,
    });

    // Configure 100% failure injection specifically for 'payment-api'
    breaker.setChaosPolicy({
      enabled: true,
      targetServicePattern: "^payment-api$",
      failureProbability: 1.0,
      simulatedErrorCode: "SIMULATED_GATEWAY_OUTAGE",
    });

    // Call targeting scoped service fails with injected fault
    await assert.rejects(async () => breaker.execute(() => "NORMAL_TX", undefined, "payment-api"), {
      message: /CHAOS_INJECTED_FAULT: SIMULATED_GATEWAY_OUTAGE/,
    });

    // Call targeting different unscoped service passes without fault injection
    const unscopedRes = await breaker.execute(() => "UNSCOPED_SUCCESS", undefined, "unrelated-service");
    assert.equal(unscopedRes, "UNSCOPED_SUCCESS");
  });

  // -------------------------------------------------------------------------
  // BDD-1454: Cryptographic SHA-256 Resilience Receipt Generation
  // -------------------------------------------------------------------------
  it("BDD-1454: writes authentic resilience receipt with valid SHA-256 signature to disk", async () => {
    const testReceiptPath = resolveEvidencePath("CHAOS_RECEIPT.json", ROOT);
    const breaker = new EosChaosCircuitBreaker("metrics-service", {
      evidencePath: testReceiptPath,
    });

    await breaker.execute(() => "OK");
    const receipt = breaker.generateReceipt();

    assert.ok(fs.existsSync(testReceiptPath));
    assert.equal(typeof receipt.sha256, "string");
    assert.equal(receipt.sha256.length, 64);
    assert.equal(receipt.metrics.totalCalls, 1);

    const onDisk = JSON.parse(fs.readFileSync(testReceiptPath, "utf8"));
    assert.equal(onDisk.evidenceSha256, receipt.sha256);
  });
});
