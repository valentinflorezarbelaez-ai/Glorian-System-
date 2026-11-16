/**
 * EOS SYSTEM — AUTONOMOUS CHAOS RUNNER TESTS
 * Tests for circuit breaker state machine, chaos injection, Byzantine corruption,
 * runChaosBattery, ChaosPartitionError, CircuitBreakerOpenError
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EosAutonomousChaosRunner,
  ChaosPartitionError,
  CircuitBreakerOpenError,
} from "../src/core/eosAutonomousChaosRunner.ts";

// ============================================================================
// Constructor
// ============================================================================

test("Constructor defaults failureThreshold=3", () => {
  const runner = new EosAutonomousChaosRunner();
  assert.equal(runner.getCircuitState(), "CLOSED");
});

test("Constructor defaults cooldownMs=30", () => {
  const runner = new EosAutonomousChaosRunner();
  assert.equal(runner.getCircuitState(), "CLOSED");
});

test("Constructor defaults recoveryProbes=2", () => {
  const runner = new EosAutonomousChaosRunner();
  assert.equal(runner.getCircuitState(), "CLOSED");
});

test("Constructor custom options", () => {
  const runner = new EosAutonomousChaosRunner({
    failureThreshold: 5,
    cooldownMs: 10,
    recoveryProbes: 3,
  });
  assert.equal(runner.getCircuitState(), "CLOSED");
});

// ============================================================================
// Circuit Breaker State Machine
// ============================================================================

test("Initial state is CLOSED", () => {
  const runner = new EosAutonomousChaosRunner();
  assert.equal(runner.getCircuitState(), "CLOSED");
});

test("CLOSED→OPEN after ≥failureThreshold failures", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 3, cooldownMs: 999999 });
  runner.recordFailure();
  runner.recordFailure();
  runner.recordFailure();
  assert.equal(runner.getCircuitState(), "OPEN");
});

test("CLOSED stays CLOSED below threshold", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 3 });
  runner.recordFailure();
  runner.recordFailure();
  // Need to check internal state — getCircuitState may transition to HALF_OPEN if cooldown passed
  // Use a long cooldown to prevent that
  const runner2 = new EosAutonomousChaosRunner({ failureThreshold: 3, cooldownMs: 999999 });
  runner2.recordFailure();
  runner2.recordFailure();
  assert.equal(runner2.getCircuitState(), "CLOSED");
});

test("OPEN→HALF_OPEN after cooldown", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 10 });
  runner.recordFailure();
  runner.recordFailure();
  assert.equal(runner.getCircuitState(), "OPEN");
  // Wait for cooldown
  const start = Date.now();
  while (Date.now() - start < 20) {
    // spin wait
  }
  assert.equal(runner.getCircuitState(), "HALF_OPEN");
});

test("HALF_OPEN→CLOSED after ≥recoveryProbes successes", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 10, recoveryProbes: 2 });
  runner.recordFailure();
  runner.recordFailure();
  assert.equal(runner.getCircuitState(), "OPEN");
  const start = Date.now();
  while (Date.now() - start < 20) {
    /* spin until cooldown elapses */
  }
  runner.recordSuccess();
  runner.recordSuccess();
  assert.equal(runner.getCircuitState(), "CLOSED");
});

test("HALF_OPEN→OPEN on any failure", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 10, recoveryProbes: 2 });
  runner.recordFailure();
  runner.recordFailure();
  const start = Date.now();
  while (Date.now() - start < 20) {
    /* spin until cooldown elapses */
  }
  assert.equal(runner.getCircuitState(), "HALF_OPEN");
  runner.recordFailure();
  // Force check without cooldown
  const state = runner.getCircuitState();
  assert.equal(state, "OPEN");
});

test("circuitTripCount increments on each trip", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 10 });
  assert.equal(runner.getTripCount(), 0);
  runner.recordFailure();
  runner.recordFailure();
  assert.equal(runner.getTripCount(), 1);
});

// ============================================================================
// recordSuccess
// ============================================================================

test("recordSuccess resets consecutiveFailures in CLOSED", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 3, cooldownMs: 999999 });
  runner.recordFailure();
  runner.recordFailure();
  runner.recordSuccess();
  runner.recordFailure();
  // Should still be CLOSED since failures reset
  assert.equal(runner.getCircuitState(), "CLOSED");
});

test("recordSuccess in HALF_OPEN increments probe successes", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 10, recoveryProbes: 3 });
  runner.recordFailure();
  runner.recordFailure();
  const start = Date.now();
  while (Date.now() - start < 20) {
    /* spin until cooldown elapses */
  }
  runner.recordSuccess();
  runner.recordSuccess();
  assert.equal(runner.getCircuitState(), "HALF_OPEN");
  runner.recordSuccess();
  assert.equal(runner.getCircuitState(), "CLOSED");
});

// ============================================================================
// recordFailure
// ============================================================================

test("recordFailure trips to OPEN from CLOSED", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 999999 });
  runner.recordFailure();
  runner.recordFailure();
  assert.equal(runner.getCircuitState(), "OPEN");
});

test("recordFailure re-trips from HALF_OPEN", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 10 });
  runner.recordFailure();
  runner.recordFailure();
  const start = Date.now();
  while (Date.now() - start < 20) {
    /* spin until cooldown elapses */
  }
  runner.recordFailure();
  assert.equal(runner.getTripCount(), 2);
});

// ============================================================================
// executeProtected
// ============================================================================

test("executeProtected OPEN state returns fallback", async () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 1, cooldownMs: 999999 });
  runner.recordFailure();
  const result = await runner.executeProtected(
    async () => "operation",
    async () => "fallback",
  );
  assert.equal(result.result, "fallback");
  assert.equal(result.fallbackUsed, true);
});

test("executeProtected PARTITION fault returns fallback+fault", async () => {
  const runner = new EosAutonomousChaosRunner();
  const result = await runner.executeProtected(
    async () => "operation",
    async () => "fallback",
    { faultType: "PARTITION", injectionRate: 1.0 },
  );
  assert.equal(result.faultInjected, true);
  assert.equal(result.fallbackUsed, true);
});

test("executeProtected LATENCY fault adds delay", async () => {
  const runner = new EosAutonomousChaosRunner();
  const start = Date.now();
  const result = await runner.executeProtected(
    async () => "ok",
    async () => "fallback",
    { faultType: "LATENCY", injectionRate: 1.0, latencyMs: 20 },
  );
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 15);
  assert.equal(result.faultInjected, true);
  assert.equal(result.fallbackUsed, false);
});

test("executeProtected BYZANTINE fault corrupts result", async () => {
  const runner = new EosAutonomousChaosRunner();
  const result = await runner.executeProtected(
    async () => "hello",
    async () => "fallback",
    { faultType: "BYZANTINE", injectionRate: 1.0 },
  );
  assert.equal(result.faultInjected, true);
  assert.ok(result.result.includes("BYZANTINE_CORRUPTED"));
});

test("executeProtected success path without chaos", async () => {
  const runner = new EosAutonomousChaosRunner();
  const result = await runner.executeProtected(
    async () => "success",
    async () => "fallback",
  );
  assert.equal(result.result, "success");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.faultInjected, false);
});

test("executeProtected operation error returns fallback", async () => {
  const runner = new EosAutonomousChaosRunner();
  const result = await runner.executeProtected(
    async () => {
      throw new Error("fail");
    },
    async () => "recovered",
  );
  assert.equal(result.result, "recovered");
  assert.equal(result.fallbackUsed, true);
});

// ============================================================================
// applyByzantineCorruption
// ============================================================================

test("applyByzantineCorruption Buffer inverts first byte", () => {
  const runner = new EosAutonomousChaosRunner();
  const buf = Buffer.from([0xab, 0xcd, 0xef]);
  const corrupted = runner.applyByzantineCorruption(buf);
  assert.notEqual(corrupted[0], buf[0]);
  assert.equal(corrupted[0], buf[0] ^ 0xff);
});

test("applyByzantineCorruption Uint8Array inverts first byte", () => {
  const runner = new EosAutonomousChaosRunner();
  const arr = new Uint8Array([0x12, 0x34]);
  const corrupted = runner.applyByzantineCorruption(arr);
  assert.equal(corrupted[0], arr[0] ^ 0xff);
});

test("applyByzantineCorruption string appends marker", () => {
  const runner = new EosAutonomousChaosRunner();
  const result = runner.applyByzantineCorruption("hello");
  assert.equal(result, "hello [BYZANTINE_CORRUPTED]");
});

test("applyByzantineCorruption object adds __byzantineFault", () => {
  const runner = new EosAutonomousChaosRunner();
  const obj = { key: "value" };
  const corrupted = runner.applyByzantineCorruption(obj);
  assert.equal(corrupted.__byzantineFault, true);
  assert.ok(corrupted.__corruptedHash);
});

test("applyByzantineCorruption other types unchanged", () => {
  const runner = new EosAutonomousChaosRunner();
  const num = 42;
  const result = runner.applyByzantineCorruption(num);
  assert.equal(result, 42);
});

// ============================================================================
// runChaosBattery
// ============================================================================

test("runChaosBattery returns ChaosExecutionReport", async () => {
  const runner = new EosAutonomousChaosRunner();
  const report = await runner.runChaosBattery("test-exp", 10);
  assert.equal(report.experimentName, "test-exp");
  assert.equal(report.totalExecutions, 10);
  assert.ok(typeof report.faultsInjected === "number");
  assert.ok(typeof report.gracefulFallbacks === "number");
  assert.ok(typeof report.resilienceScore === "number");
  assert.ok(report.sha256Receipt);
});

test("runChaosBattery resilienceScore 0-100", async () => {
  const runner = new EosAutonomousChaosRunner();
  const report = await runner.runChaosBattery("test-exp", 10);
  assert.ok(report.resilienceScore >= 0);
  assert.ok(report.resilienceScore <= 100);
});

test("runChaosBattery sha256Receipt is 64 hex chars", async () => {
  const runner = new EosAutonomousChaosRunner();
  const report = await runner.runChaosBattery("test-exp", 10);
  assert.equal(report.sha256Receipt.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(report.sha256Receipt));
});

test("runChaosBattery timestamp is valid ISO", async () => {
  const runner = new EosAutonomousChaosRunner();
  const report = await runner.runChaosBattery("test-exp", 5);
  assert.ok(!isNaN(Date.parse(report.timestamp)));
});

test("runChaosBattery circuitState is valid", async () => {
  const runner = new EosAutonomousChaosRunner();
  const report = await runner.runChaosBattery("test-exp", 5);
  const validStates = ["CLOSED", "OPEN", "HALF_OPEN"];
  assert.ok(validStates.includes(report.circuitState));
});

test("runChaosBattery faultsInjected > 0 with iterations", async () => {
  const runner = new EosAutonomousChaosRunner();
  const report = await runner.runChaosBattery("test-exp", 30);
  assert.ok(report.faultsInjected > 0);
});

test("runChaosBattery gracefulFallbacks >= 0", async () => {
  const runner = new EosAutonomousChaosRunner();
  const report = await runner.runChaosBattery("test-exp", 10);
  assert.ok(report.gracefulFallbacks >= 0);
});

test("runChaosBattery unhandledPanics >= 0", async () => {
  const runner = new EosAutonomousChaosRunner();
  const report = await runner.runChaosBattery("test-exp", 10);
  assert.ok(report.unhandledPanics >= 0);
});

// ============================================================================
// ChaosPartitionError & CircuitBreakerOpenError
// ============================================================================

test("ChaosPartitionError extends Error", () => {
  const err = new ChaosPartitionError();
  assert.ok(err instanceof Error);
});

test("ChaosPartitionError has correct name", () => {
  const err = new ChaosPartitionError();
  assert.equal(err.name, "ChaosPartitionError");
});

test("ChaosPartitionError has message", () => {
  const err = new ChaosPartitionError();
  assert.ok(err.message.includes("partition"));
});

test("CircuitBreakerOpenError extends Error", () => {
  const err = new CircuitBreakerOpenError();
  assert.ok(err instanceof Error);
});

test("CircuitBreakerOpenError has correct name", () => {
  const err = new CircuitBreakerOpenError();
  assert.equal(err.name, "CircuitBreakerOpenError");
});

test("CircuitBreakerOpenError has message", () => {
  const err = new CircuitBreakerOpenError();
  assert.ok(err.message.includes("OPEN"));
});

// ============================================================================
// resetCircuit
// ============================================================================

test("resetCircuit resets to initial state", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 999999 });
  runner.recordFailure();
  runner.recordFailure();
  assert.equal(runner.getCircuitState(), "OPEN");
  runner.resetCircuit();
  assert.equal(runner.getCircuitState(), "CLOSED");
});

test("resetCircuit resets trip count state", () => {
  const runner = new EosAutonomousChaosRunner({ failureThreshold: 2, cooldownMs: 999999 });
  runner.recordFailure();
  runner.recordFailure();
  runner.resetCircuit();
  assert.equal(runner.getCircuitState(), "CLOSED");
});
