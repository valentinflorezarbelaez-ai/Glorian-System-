/**
 * test/eosVercelCanaryObservability.test.mjs
 * Verification suite for SPEC-107: Sovereign Cross-Fleet Telemetry & Canary Observability
 *
 * Covers:
 * - BDD-273: Dynamic Fleet Soundcheck porcelain & endpoint verification
 * - BDD-274: Canary Health Index (CHI) calculation & progressive promotion
 * - BDD-275: Error budget breach & deterministic automatic rollback
 * - Edge cases, precondition checks, immutability, and MCP server tool integration
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosVercelCanaryObservability } from "../src/core/eosVercelCanaryObservability.ts";
import { EosFleetSoundcheckMesh } from "../src/core/eosFleetSoundcheckMesh.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-273: Dynamic Fleet Soundcheck calculates real-time scores via git porcelain and endpoints", () => {
  const audit = EosFleetSoundcheckMesh.auditFleet(projectRoot);

  assert.equal(typeof audit, "object");
  assert.ok(audit.fleetAverageScore >= 0 && audit.fleetAverageScore <= 100);
  assert.ok(audit.sha256Receipt.length === 64);
  assert.ok(Array.isArray(audit.reports));
  assert.ok(audit.reports.length >= 5);

  const ptgRepo = audit.reports.find((r) => r.id === "performance-talent-group");
  assert.ok(ptgRepo, "Performance Talent Group must be registered in fleet");
  assert.equal(ptgRepo.workingTreeClean, true, "PTG repository should have clean porcelain working tree");
  assert.ok(ptgRepo.totalScore >= 90, `PTG score should be high, received ${ptgRepo.totalScore}`);
});

test("BDD-274: EosVercelCanaryObservability calculates CHI and promotes healthy canaries", () => {
  const result = EosVercelCanaryObservability.evaluateMetrics({
    deploymentId: "dpl_ptg_canary_001",
    environment: "production",
    stage: "CANARY_5_PCT",
    errorRate5xx: 0.002, // 0.2% error rate (well below 1.0%)
    latencyP99Ms: 240, // 240ms (well below 800ms ceiling)
    requestCount: 1500,
  });

  assert.ok(result.canaryHealthIndex >= 85, `Expected CHI >= 85, got ${result.canaryHealthIndex}`);
  assert.equal(result.decision, "PROCEED_TO_NEXT_STAGE");
  assert.ok(result.errorBudgetRemainingPercent >= 70);
  assert.equal(result.deploymentId, "dpl_ptg_canary_001");
  assert.equal(result.stage, "CANARY_5_PCT");
  assert.ok(result.sha256Receipt.length === 64);
  assert.ok(Object.isFrozen(result), "Result should be immutable via deepFreeze");
});

test("BDD-275: EosVercelCanaryObservability triggers immediate rollback upon error budget breach", () => {
  const result = EosVercelCanaryObservability.evaluateMetrics({
    deploymentId: "dpl_ptg_canary_002",
    environment: "production",
    stage: "CANARY_25_PCT",
    errorRate5xx: 0.025, // 2.5% error rate (exceeds 1.0% critical threshold)
    latencyP99Ms: 310,
    requestCount: 2000,
  });

  assert.equal(result.decision, "ROLLBACK_TRIGGERED");
  assert.ok(result.rationale.includes("Circuit breaker tripped"));
  assert.ok(result.canaryHealthIndex < 70);
  assert.equal(result.errorBudgetRemainingPercent, 0);
  assert.ok(result.sha256Receipt.length === 64);
});

test("SPEC-107: Latency P99 penalty reduces CHI and holds deployment when latency exceeds 800ms", () => {
  const result = EosVercelCanaryObservability.evaluateMetrics({
    deploymentId: "dpl_ptg_canary_slow",
    environment: "production",
    stage: "CANARY_5_PCT",
    errorRate5xx: 0.008, // 0.8% error rate (close to threshold)
    latencyP99Ms: 1400, // High latency: 1400ms > 800ms
    requestCount: 500,
  });

  assert.ok(result.latencyP99Ms > 800);
  assert.ok(result.canaryHealthIndex < 85);
  assert.ok(result.decision === "HOLD_AND_OBSERVE" || result.decision === "ROLLBACK_TRIGGERED");
});

test("SPEC-107: Small sample batches incur penalty to prevent premature promotion", () => {
  const lowSampleResult = EosVercelCanaryObservability.evaluateMetrics({
    deploymentId: "dpl_low_sample",
    environment: "production",
    stage: "CANARY_1_PCT",
    errorRate5xx: 0.0,
    latencyP99Ms: 120,
    requestCount: 20, // < 50 requests
  });

  const highSampleResult = EosVercelCanaryObservability.evaluateMetrics({
    deploymentId: "dpl_high_sample",
    environment: "production",
    stage: "CANARY_1_PCT",
    errorRate5xx: 0.0,
    latencyP99Ms: 120,
    requestCount: 200, // >= 50 requests
  });

  assert.equal(highSampleResult.canaryHealthIndex, 100);
  assert.equal(lowSampleResult.canaryHealthIndex, 95); // 5 points sample penalty
});

test("SPEC-107: Contract invariants and precondition assertions reject invalid inputs", () => {
  // Empty deploymentId
  assert.throws(() => {
    EosVercelCanaryObservability.evaluateMetrics({
      deploymentId: "",
      environment: "production",
      stage: "CANARY_1_PCT",
      errorRate5xx: 0.01,
      latencyP99Ms: 200,
      requestCount: 100,
    });
  }, /deploymentId must not be empty/);

  // Out of bounds errorRate5xx (< 0)
  assert.throws(() => {
    EosVercelCanaryObservability.evaluateMetrics({
      deploymentId: "dpl_test",
      environment: "production",
      stage: "CANARY_1_PCT",
      errorRate5xx: -0.1,
      latencyP99Ms: 200,
      requestCount: 100,
    });
  }, /errorRate5xx must be bounded in \[0, 1\]/);

  // Out of bounds errorRate5xx (> 1)
  assert.throws(() => {
    EosVercelCanaryObservability.evaluateMetrics({
      deploymentId: "dpl_test",
      environment: "production",
      stage: "CANARY_1_PCT",
      errorRate5xx: 1.5,
      latencyP99Ms: 200,
      requestCount: 100,
    });
  }, /errorRate5xx must be bounded in \[0, 1\]/);

  // Negative latency
  assert.throws(() => {
    EosVercelCanaryObservability.evaluateMetrics({
      deploymentId: "dpl_test",
      environment: "production",
      stage: "CANARY_1_PCT",
      errorRate5xx: 0.01,
      latencyP99Ms: -50,
      requestCount: 100,
    });
  }, /latencyP99Ms must be non-negative/);
});

test("SPEC-107: MCP Server successfully handles eos_canary_telemetry_evaluate tool calls", () => {
  const server = new EosMcpServer(projectRoot, "full");

  const response = server.handleRequest({
    jsonrpc: "2.0",
    id: "mcp-test-107",
    method: "tools/call",
    params: {
      name: "eos_canary_telemetry_evaluate",
      arguments: {
        deploymentId: "dpl_ptg_canary_mcp",
        environment: "production",
        stage: "CANARY_1_PCT",
        errorRate5xx: 0.001,
        latencyP99Ms: 180,
        requestCount: 1000,
      },
    },
  });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, "mcp-test-107");
  assert.ok(response.result);
  assert.ok(Array.isArray(response.result.content));
  assert.equal(response.result.content[0].type, "text");

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.deploymentId, "dpl_ptg_canary_mcp");
  assert.equal(payload.decision, "PROCEED_TO_NEXT_STAGE");
  assert.ok(payload.canaryHealthIndex >= 85);
  assert.ok(payload.sha256Receipt.length === 64);
});
