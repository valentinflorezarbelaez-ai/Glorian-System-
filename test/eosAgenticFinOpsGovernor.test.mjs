/**
 * Unit Test Suite for EosAgenticFinOpsGovernor
 * Specification: SPEC-118 (IEEE 830 / ISO 29148 / Big Tech FinOps Standard)
 * Acceptance Criteria: BDD-315 to BDD-319
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosAgenticFinOpsGovernor } from "../src/core/eosAgenticFinOpsGovernor.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-315: Dynamic Mid-Task Cost Routing & Complexity Classification", () => {
  const governor = EosAgenticFinOpsGovernor.getInstance();
  governor.reset();

  const routineTask = governor.classifyTaskCostTier("format-lint-ast-check", 5000);
  assert.equal(routineTask.tier, "TIER_1_LOCAL_SLM");
  assert.ok(routineTask.ratePerMillionUsd.prompt <= 0.15);
  assert.equal(routineTask.sha256Attestation.length, 64);

  const frontierTask = governor.classifyTaskCostTier("formal-tla-invariant-synthesis-and-concurrency", 10000);
  assert.equal(frontierTask.tier, "TIER_3_FRONTIER_REASONING");
  assert.ok(frontierTask.ratePerMillionUsd.prompt >= 3.0);
  assert.equal(frontierTask.sha256Attestation.length, 64);

  const balancedTask = governor.classifyTaskCostTier("implement-user-authentication-service", 6000);
  assert.equal(balancedTask.tier, "TIER_2_BALANCED");

  const status = governor.getStatus();
  assert.equal(status.totalDirectivesRouted, 3);
  assert.equal(status.tierDistribution.TIER_1_LOCAL_SLM, 1);
  assert.equal(status.tierDistribution.TIER_2_BALANCED, 1);
  assert.equal(status.tierDistribution.TIER_3_FRONTIER_REASONING, 1);
});

test("BDD-316: Cognitive Stagnation Detection & Infinite Token Bleed Circuit Breaker", () => {
  const governor = EosAgenticFinOpsGovernor.getInstance();
  governor.reset();

  // Distinct progressing diffs
  const progressingDiffs = [
    "function add(a, b) { return a + b; }",
    "function add(a: number, b: number): number { return a + b; }"
  ];
  const eval1 = governor.evaluateStagnation(progressingDiffs, false);
  assert.equal(eval1.stagnant, false);
  assert.equal(eval1.action, "PROCEED_NOMINAL");

  // 3 consecutive stagnant diffs with failing tests (>85% similarity)
  const baseCode = "export function processTransaction(id: string, amount: number, currency: string) { if (amount <= 0) throw new Error('Invalid'); return { id, amount, currency, status: 'PROCESSED' }; }";
  const stagnantDiffs = [
    `${baseCode} // attempt 1`,
    `${baseCode} // attempt 2`,
    `${baseCode} // attempt 3`
  ];
  const eval2 = governor.evaluateStagnation(stagnantDiffs, false);
  assert.equal(eval2.stagnant, true);
  assert.equal(eval2.circuitBreakerState, "CIRCUIT_TRIPPED_STAGNATION");
  assert.equal(eval2.action, "SIGSTOP_EMERGENCY");
  assert.ok(eval2.similarityScore >= 0.85);
  assert.equal(eval2.sha256Attestation.length, 64);

  const status = governor.getStatus();
  assert.equal(status.stagnationEventsDetected, 1);
  assert.equal(status.state, "CIRCUIT_ACTIVE");
});

test("BDD-317: Ephemeral Task Wallet Hard-Cap Depletion & Fail-Closed Cutoff", () => {
  const governor = EosAgenticFinOpsGovernor.getInstance();
  governor.reset();

  const wallet = governor.allocateWallet("mission-alpha-123", 1.0); // $1.00 USD hard cap
  assert.equal(wallet.status, "ACTIVE");
  assert.equal(wallet.remainingBudgetUsd, 1.0);

  // Consume $0.85 (85% of budget)
  // At Tier 3: prompt is $3.0/M, completion is $15.0/M.
  // 50,000 prompt tokens ($0.15) + 50,000 completion tokens ($0.75) = $0.90 USD.
  const updatedWallet = governor.recordTokenUsage("mission-alpha-123", 50000, 50000, "TIER_3_FRONTIER_REASONING");
  assert.equal(updatedWallet.status, "WARN_BUDGET_DEPLETION");
  assert.equal(updatedWallet.fallbackToLocal, false);

  // Consume additional tokens pushing past $1.00 USD cap
  const cappedWallet = governor.recordTokenUsage("mission-alpha-123", 20000, 20000, "TIER_3_FRONTIER_REASONING");
  assert.equal(cappedWallet.status, "CUTOFF_FAIL_CLOSED");
  assert.equal(cappedWallet.fallbackToLocal, true);
  assert.equal(cappedWallet.remainingBudgetUsd, 0);
});

test("BDD-318: 30-Day Code Survival & Human ROI Evaluation", () => {
  const governor = EosAgenticFinOpsGovernor.getInstance();
  governor.reset();

  const healthyComponents = [
    { componentId: "comp-1", initialLines: 100, retainedLines30Days: 90, totalInferenceCostUsd: 1.5 },
    { componentId: "comp-2", initialLines: 200, retainedLines30Days: 180, totalInferenceCostUsd: 3.0 }
  ];

  const healthyReport = governor.evaluateCodeSurvival(healthyComponents, 120);
  assert.equal(healthyReport.averageSurvivalRatePercent, 90.0);
  assert.equal(healthyReport.netNegativeAiDebt, false);
  assert.ok(healthyReport.netSavingsUsd > 1000); // 270 lines / 15 * 120 - 4.5 = $2155.5
  assert.equal(healthyReport.sha256Attestation.length, 64);

  // Decayed/Churned components with >30% churn
  const decayedComponents = [
    { componentId: "comp-3", initialLines: 100, retainedLines30Days: 40, totalInferenceCostUsd: 2.0 }
  ];
  const decayedReport = governor.evaluateCodeSurvival(decayedComponents, 120);
  assert.equal(decayedReport.averageSurvivalRatePercent, 40.0);
  assert.equal(decayedReport.netNegativeAiDebt, true); // Churn is 60% > 30%
});

test("BDD-319: EosMcpServer Integration for FinOps Tools Dispatch", async () => {
  const server = new EosMcpServer(process.cwd());

  // 1. Test eos_finops_route_task
  const routeReq = {
    jsonrpc: "2.0",
    id: "test-finops-1",
    method: "tools/call",
    params: {
      name: "eos_finops_route_task",
      arguments: {
        directive: "read-and-lint-source-tree",
        estimatedTokens: 3000
      }
    }
  };
  const routeRes = await server.handleRequest(routeReq);
  assert.equal(routeRes.error, undefined);
  assert.ok(routeRes.result);
  const routeData = JSON.parse(routeRes.result.content[0].text);
  assert.equal(routeData.tier, "TIER_1_LOCAL_SLM");
  assert.equal(routeData.sha256Attestation.length, 64);

  // 2. Test eos_finops_evaluate_stagnation
  const stagReq = {
    jsonrpc: "2.0",
    id: "test-finops-2",
    method: "tools/call",
    params: {
      name: "eos_finops_evaluate_stagnation",
      arguments: {
        diffHistory: ["diff A", "diff A", "diff A"],
        testPassed: false
      }
    }
  };
  const stagRes = await server.handleRequest(stagReq);
  assert.equal(stagRes.error, undefined);
  assert.ok(stagRes.result);
  const stagData = JSON.parse(stagRes.result.content[0].text);
  assert.equal(stagData.stagnant, true);
  assert.equal(stagData.action, "SIGSTOP_EMERGENCY");

  // 3. Test eos_finops_wallet_status
  const walletReq = {
    jsonrpc: "2.0",
    id: "test-finops-3",
    method: "tools/call",
    params: {
      name: "eos_finops_wallet_status",
      arguments: {}
    }
  };
  const walletRes = await server.handleRequest(walletReq);
  assert.equal(walletRes.error, undefined);
  assert.ok(walletRes.result);
  const walletData = JSON.parse(walletRes.result.content[0].text);
  assert.ok(walletData.totalDirectivesRouted >= 1);
});
