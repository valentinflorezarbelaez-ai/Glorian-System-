/**
 * Test Suite for SPEC-150: Autonomous Closed-Loop Self-Healing & AST Mutation Engine (Level 5 Core)
 * Acceptance Criteria: BDD-450, BDD-451, BDD-452, BDD-453, BDD-454, BDD-455
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EosAutonomousSelfHealingEngine
} from "../src/core/eosAutonomousSelfHealingEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-450: Fault Isolation & Minimal Causal Blast Radius Extraction", () => {
  const engine = new EosAutonomousSelfHealingEngine({ projectRoot });

  const errorLog = `
    TypeError: Cannot read property 'items' of undefined
      at calculateScorecard (src/core/eosProductDeliveryOrchestrator.ts:142:15)
      at EosProductDeliveryOrchestrator.deliverProduct (src/core/eosProductDeliveryOrchestrator.ts:380:10)
  `;

  const result = engine.isolateFault(errorLog);
  assert.equal(result.targetFile, "src/core/eosProductDeliveryOrchestrator.ts");
  assert.equal(result.line, 142);
  assert.equal(result.targetSymbol, "items");
  assert.ok(result.causalBlastRadiusMs < 20, `Blast radius took ${result.causalBlastRadiusMs}ms >= 20ms`);
  assert.ok(result.affectedNodes.length >= 1);
});

test("BDD-451: Surgical AST Candidate Patch Synthesis (SapFix Standard)", () => {
  const engine = new EosAutonomousSelfHealingEngine({ projectRoot });

  // 1. Null pointer guard
  const nullGuardCandidates = engine.synthesizeCandidateMutations(
    "src/core/sampleModule.ts",
    "NULL_POINTER_GUARD",
    { symbol: "userContext" }
  );
  assert.ok(nullGuardCandidates.length >= 2, "Must generate at least 2 candidate mutations");
  assert.ok(nullGuardCandidates.some(c => c.mutatedSnippet.includes("userContext?.")));
  assert.ok(nullGuardCandidates.every(c => c.diff.startsWith("- ")));

  // 2. Timeout / Backoff retry
  const backoffCandidates = engine.synthesizeCandidateMutations(
    "src/core/sampleModule.ts",
    "TIMEOUT_BACKOFF_RETRY"
  );
  assert.ok(backoffCandidates.length >= 1);
  assert.ok(backoffCandidates[0].mutatedSnippet.includes("attempt <= 5"));

  // 3. Grid spacing
  const gridCandidates = engine.synthesizeCandidateMutations(
    "src/ui/sampleView.html",
    "GRID_SPACING_CONFORMANCE"
  );
  assert.ok(gridCandidates.length >= 1);
  assert.ok(gridCandidates[0].mutatedSnippet.includes("12px 16px"));
});

test("BDD-452: Hermetic Sandboxed Patch Verification", () => {
  const engine = new EosAutonomousSelfHealingEngine({ projectRoot });

  const candidate = {
    id: "MUT-TEST-01",
    archetype: "NULL_POINTER_GUARD",
    targetFile: "src/core/sampleModule.ts",
    targetSymbol: "account",
    originalSnippet: "account.balance",
    mutatedSnippet: "account?.balance ?? 0",
    rationale: "Guard optional balance access",
    diff: "- account.balance\n+ account?.balance ?? 0"
  };

  const evalResult = engine.evaluateCandidateInSandbox(candidate);
  assert.equal(evalResult.passed, true);
  assert.equal(evalResult.testsRun, 1);
  assert.equal(evalResult.testsPassed, 1);
  assert.ok(evalResult.executionTimeMs >= 0);
  assert.equal(evalResult.regressionFindings.length, 0);
});

test("BDD-453: Fail-Closed Candidate Discard on Regression", () => {
  const engine = new EosAutonomousSelfHealingEngine({ projectRoot });

  const buggyCandidate = {
    id: "MUT-BUGGY-02",
    archetype: "NULL_POINTER_GUARD",
    targetFile: "src/core/sampleModule.ts",
    targetSymbol: "account",
    originalSnippet: "account.balance",
    mutatedSnippet: "throw new Error('Intentional regression test');",
    rationale: "Faulty mutation test",
    diff: "- account.balance\n+ throw new Error"
  };

  const regressiveSnippet = `
    try {
      ${buggyCandidate.mutatedSnippet}
      candidateResult = true;
    } catch (e) {
      candidateResult = false;
    }
  `;

  const evalResult = engine.evaluateCandidateInSandbox(buggyCandidate, regressiveSnippet);
  assert.equal(evalResult.passed, false);
  assert.ok(evalResult.regressionFindings.length >= 1);
});

test("BDD-454: Autonomous Closed-Loop Promotion and Ledger Attestation", () => {
  const engine = new EosAutonomousSelfHealingEngine({ projectRoot });

  const report = engine.runAutonomousHealingLoop({
    targetFile: "src/core/sampleHealingTarget.ts",
    diagnosticReport: "TypeError: Cannot read property 'token' of undefined at validateToken (src/core/auth.ts:15)",
    archetype: "NULL_POINTER_GUARD",
    dryRun: true
  });

  assert.equal(report.status, "HEALED");
  assert.equal(report.archetype, "NULL_POINTER_GUARD");
  assert.ok(report.appliedMutation !== null);
  assert.ok(report.evaluations.length >= 1);
  assert.match(report.sha256Receipt, /^[a-f0-9]{64}$/);
  assert.ok(report.traceId.length === 32);
  assert.ok(report.durationMs < 1000, `durationMs ${report.durationMs} >= 1000`);

  // Check history retrieval
  const history = engine.getHealingHistory();
  assert.ok(history.length >= 1);
  assert.equal(history[0].healingId, report.healingId);
});

test("BDD-455: MCP Tool Dispatch & OpenTelemetry Span Linkage", async () => {
  const engine = EosAutonomousSelfHealingEngine.getInstance({ projectRoot });

  const healReport = engine.runAutonomousHealingLoop({
    diagnosticReport: "Error: EBUSY: resource locked on file write",
    archetype: "TIMEOUT_BACKOFF_RETRY",
    dryRun: true
  });

  assert.equal(healReport.status, "HEALED");
  assert.equal(healReport.archetype, "TIMEOUT_BACKOFF_RETRY");
  assert.ok(healReport.traceId, "TraceId must be present linking OpenTelemetry span");
  assert.match(healReport.sha256Receipt, /^[a-f0-9]{64}$/);
});
