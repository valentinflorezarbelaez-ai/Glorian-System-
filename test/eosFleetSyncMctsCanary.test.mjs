/**
 * EOS SYSTEM — SPEC-042: SOVEREIGN FLEET SOUNDCHECK, MCTS & CANARY TEST SUITE
 * Validates BDD-119 through BDD-123.
 *
 * Requirements:
 * - 100% native node:test execution.
 * - Strict assertion of Soundcheck scoring, MCTS with UCT, and Canary circuit-breaker rollback.
 * - Zero external dependencies.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosFleetSoundcheckMesh } from "../src/core/eosFleetSoundcheckMesh.ts";

import { EosMctsHyperTuner } from "../src/core/eosMctsHyperTuner.ts";

import { EosProgressiveCanaryMesh } from "../src/core/eosProgressiveCanaryMesh.ts";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

describe("SPEC-042: Sovereign Fleet Soundcheck, MCTS & Progressive Canary Verification", () => {
  describe("BDD-119: Sovereign Fleet Soundcheck Evaluation & Quorum", () => {
    it("audits registered fleet repositories and computes Soundcheck scores", () => {
      const report = EosFleetSoundcheckMesh.auditFleet(projectRoot);

      assert.ok(report.totalRepositories >= 5);
      assert.ok(report.fleetAverageScore >= 0 && report.fleetAverageScore <= 100);
      assert.equal(typeof report.deploymentAuthorizedQuorum, "boolean");
      assert.equal(typeof report.sha256Receipt, "string");
      assert.equal(report.sha256Receipt.length, 64);

      // Verify core repo has highest score
      const core = report.reports.find((r) => r.id === "eos-system");
      assert.ok(core);
      assert.equal(core.workingTreeClean, true);
      assert.ok(core.totalScore >= 90);
      assert.equal(core.eligibleForAutonomousDeploy, true);
    });
  });

  describe("BDD-120: MCTS Parameter Hyper-Tuning with UCT Policy", () => {
    it("converges to a configuration with optimal fitness >= baseline", () => {
      const tuner = new EosMctsHyperTuner(42);
      const report = tuner.tuneParameters(120);

      assert.equal(report.totalIterations, 120);
      assert.ok(report.exploredNodesCount > 1);
      assert.ok(report.optimalFitness >= report.baselineFitness);
      assert.ok(report.improvementPercent >= 0);
      assert.equal(typeof report.sha256Receipt, "string");
      assert.equal(report.sha256Receipt.length, 64);
    });
  });

  describe("BDD-121: Progressive Canary Delivery (1% -> 5% -> 25% -> 100%)", () => {
    it("advances sequentially to FULL_PRODUCTION_100_PCT when error budget is intact", () => {
      const mesh = new EosProgressiveCanaryMesh("v48.0.0", "v47.0.0");
      const telemetry = [
        { stage: "CANARY_1_PCT", sampleRequests: 10000, failedRequests: 0, p99LatencyMs: 45, baselineP99LatencyMs: 44 },
        { stage: "CANARY_5_PCT", sampleRequests: 50000, failedRequests: 1, p99LatencyMs: 46, baselineP99LatencyMs: 44 },
        {
          stage: "CANARY_25_PCT",
          sampleRequests: 250000,
          failedRequests: 2,
          p99LatencyMs: 47,
          baselineP99LatencyMs: 44,
        },
        {
          stage: "FULL_PRODUCTION_100_PCT",
          sampleRequests: 1000000,
          failedRequests: 5,
          p99LatencyMs: 48,
          baselineP99LatencyMs: 44,
        },
      ];

      const report = mesh.executeRollout(telemetry);

      assert.equal(report.finalStage, "FULL_PRODUCTION_100_PCT");
      assert.equal(report.rollbackExecuted, false);
      assert.equal(report.verifiedSafe, true);
      assert.equal(report.totalStagesCompleted, 4);
    });
  });

  describe("BDD-122: Fail-Closed Circuit Breaker Rollback on Budget Breach", () => {
    it("triggers immediate rollback when error rate burns the 0.01% error budget", () => {
      const mesh = new EosProgressiveCanaryMesh("v48.0.0", "v47.0.0");
      const telemetry = [
        { stage: "CANARY_1_PCT", sampleRequests: 10000, failedRequests: 0, p99LatencyMs: 45, baselineP99LatencyMs: 44 },
        // Error rate: 5 / 1000 = 0.5% (exceeds 0.01% limit)
        { stage: "CANARY_5_PCT", sampleRequests: 1000, failedRequests: 5, p99LatencyMs: 46, baselineP99LatencyMs: 44 },
      ];

      const report = mesh.executeRollout(telemetry);

      assert.equal(report.finalStage, "ROLLED_BACK");
      assert.equal(report.rollbackExecuted, true);
      assert.equal(report.verifiedSafe, false);
      assert.ok(report.transitions.some((t) => t.circuitBreakerTripped === true));
    });
  });

  describe("BDD-123: Multi-Channel MCP & CLI Tool Dispatch", () => {
    it("dispatches eos_fleet_soundcheck via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "eos_fleet_soundcheck",
          arguments: {},
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.ok(parsed.totalRepositories >= 5);
      assert.ok(parsed.sha256Receipt);
    });

    it("dispatches eos_mcts_tune via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "eos_mcts_tune",
          arguments: { iterations: 50, seed: 1337 },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.totalIterations, 50);
      assert.ok(parsed.optimalFitness >= parsed.baselineFitness);
    });

    it("dispatches eos_canary_rollout via MCP server", () => {
      const server = new EosMcpServer();
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "eos_canary_rollout",
          arguments: { versionTarget: "v48.0.0", previousVersion: "v47.0.0" },
        },
      });

      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.versionTarget, "v48.0.0");
      assert.equal(parsed.finalStage, "FULL_PRODUCTION_100_PCT");
    });
  });
});
