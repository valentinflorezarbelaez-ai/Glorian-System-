import { test } from "node:test";
import assert from "node:assert/strict";
import { EosPredictiveRemediationEngine } from "../src/core/eosPredictiveRemediationEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-295: Automated Remediation of Cascading Downstream Timeout (Throttle & Shed)", () => {
  const engine = new EosPredictiveRemediationEngine({ cooldownMs: 10_000 });

  // Simulate severe downstream latency degradation
  const vector = {
    burnRate5m: 16.0,             // Critical burn rate > 14.4
    burnRate1h: 6.0,
    concurrencyGradient: 0.25,     // Vegas gradient depressed (< 0.40)
    concurrencyInFlightRatio: 0.90,
    traceErrorRate: 0.05,
    traceP99LatencyMs: 1400,       // Severe tail latency (> 800ms)
    hedgeRequestRatio: 0.02,
    queueDelayMs: 25,              // Queue delay > 15ms
  };

  const result = engine.evaluateAndRemediate(vector);

  assert.strictEqual(result.archetype, "ARCHETYPE_CASCADE_TIMEOUT");
  assert.strictEqual(result.action, "ACTION_CONCURRENCY_THROTTLE");
  assert.strictEqual(result.executed, true);
  assert.ok(result.healthScore < 50, "Health score should reflect severe degradation");
  assert.ok(result.sha256Receipt.length === 64);

  const status = engine.getStatus();
  assert.strictEqual(status.activeArchetype, "ARCHETYPE_CASCADE_TIMEOUT");
  assert.strictEqual(status.activeAction, "ACTION_CONCURRENCY_THROTTLE");
  assert.strictEqual(status.totalRemediationsExecuted, 1);
});

test("BDD-296: Automated Mitigation of Thundering Herd Retry Storm (Suppress Speculative Hedges)", () => {
  const engine = new EosPredictiveRemediationEngine({ cooldownMs: 10_000 });

  // Simulate speculative hedging amplifying an error spike
  const vector = {
    burnRate5m: 8.0,
    burnRate1h: 2.0,
    concurrencyGradient: 0.85,
    concurrencyInFlightRatio: 0.70,
    traceErrorRate: 0.18,          // Error rate > 10%
    traceP99LatencyMs: 120,
    hedgeRequestRatio: 0.12,       // Excessive hedged request ratio > 5%
    queueDelayMs: 4,
  };

  const result = engine.evaluateAndRemediate(vector);

  assert.strictEqual(result.archetype, "ARCHETYPE_RETRY_STORM");
  assert.strictEqual(result.action, "ACTION_SUPPRESS_SPECULATIVE_HEDGING");
  assert.strictEqual(result.executed, true);

  const status = engine.getStatus();
  assert.strictEqual(status.activeArchetype, "ARCHETYPE_RETRY_STORM");
  assert.strictEqual(status.activeAction, "ACTION_SUPPRESS_SPECULATIVE_HEDGING");
});

test("BDD-297: Anti-Flapping Cooldown Enforcement & Safe Health Recovery", () => {
  const engine = new EosPredictiveRemediationEngine({ cooldownMs: 50_000 });

  // 1. Initial critical event
  const degradedVector = {
    burnRate5m: 18.0,
    burnRate1h: 5.0,
    concurrencyGradient: 0.20,
    concurrencyInFlightRatio: 0.95,
    traceErrorRate: 0.08,
    traceP99LatencyMs: 1200,
    hedgeRequestRatio: 0.01,
    queueDelayMs: 30,
  };

  const initialResult = engine.evaluateAndRemediate(degradedVector);
  assert.strictEqual(initialResult.executed, true);
  assert.strictEqual(initialResult.action, "ACTION_CONCURRENCY_THROTTLE");

  // 2. Immediate second alert within 50s cooldown
  const secondResult = engine.evaluateAndRemediate(degradedVector);
  assert.strictEqual(secondResult.executed, false, "Must suppress action during cooldown");
  assert.strictEqual(secondResult.suppressedReason, "SUPPRESSED_COOLDOWN_ACTIVE");
  assert.strictEqual(engine.getStatus().totalSuppressedCooldown, 1);

  // 3. Recovery to nominal health
  const nominalVector = {
    burnRate5m: 0.2,
    burnRate1h: 0.1,
    concurrencyGradient: 1.0,
    concurrencyInFlightRatio: 0.20,
    traceErrorRate: 0.0,
    traceP99LatencyMs: 15,
    hedgeRequestRatio: 0.01,
    queueDelayMs: 1,
  };

  const recoveryResult = engine.evaluateAndRemediate(nominalVector);
  assert.strictEqual(recoveryResult.archetype, "ARCHETYPE_NOMINAL");
  assert.strictEqual(recoveryResult.action, "ACTION_REVERT_TO_NOMINAL");
  assert.strictEqual(recoveryResult.executed, true);
  assert.strictEqual(engine.getStatus().activeAction, "ACTION_NONE");
  assert.ok(recoveryResult.healthScore >= 95);
});

test("BDD-298: EosMcpServer Integration for Predictive Remediation Tools", async () => {
  const server = new EosMcpServer(process.cwd());

  // Test eos_remediation_correlate_execute
  const correlateReq = {
    jsonrpc: "2.0",
    id: "req-remediation-1",
    method: "tools/call",
    params: {
      name: "eos_remediation_correlate_execute",
      arguments: {
        burnRate5m: 20.0,
        burnRate1h: 8.0,
        concurrencyGradient: 0.2,
        concurrencyInFlightRatio: 0.95,
        traceErrorRate: 0.15,
        traceP99LatencyMs: 1500,
        hedgeRequestRatio: 0.02,
        queueDelayMs: 20,
      },
    },
  };

  const correlateRes = await server.handleRequest(correlateReq);
  assert.strictEqual(correlateRes.error, undefined);
  assert.ok(correlateRes.result);
  const content = JSON.parse(correlateRes.result.content[0].text);
  assert.strictEqual(content.archetype, "ARCHETYPE_CASCADE_TIMEOUT");
  assert.strictEqual(content.action, "ACTION_CONCURRENCY_THROTTLE");
  assert.strictEqual(content.executed, true);

  // Test eos_remediation_engine_status
  const statusReq = {
    jsonrpc: "2.0",
    id: "req-remediation-2",
    method: "tools/call",
    params: {
      name: "eos_remediation_engine_status",
      arguments: {},
    },
  };

  const statusRes = await server.handleRequest(statusReq);
  assert.strictEqual(statusRes.error, undefined);
  const statusContent = JSON.parse(statusRes.result.content[0].text);
  assert.ok(statusContent.totalEvaluations >= 1);
  assert.ok(statusContent.sha256Receipt.length === 64);
});
