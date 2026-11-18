/**
 * @file eosAgenticHarnessYield.test.mjs
 * @description BDD test suite for SPEC-339 / CHANGE-201: Agentic Harness Engineering,
 * First-Pass PR Yield & Token Rework Telemetry Engine (BDD-1809..1814).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EosAgenticHarnessYieldCore,
  HarnessError,
  ORDERED_HARNESS_STAGES,
} from "../src/core/eosAgenticHarnessYield.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/AGENTIC_HARNESS_YIELD_RECEIPT.json");

test("SPEC-339 / CHANGE-201: Agentic Harness Engineering, First-Pass PR Yield & Token Rework Telemetry Engine", async (t) => {
  await t.test("BDD-1809: Spec-Driven Readiness Gate & Fail-Closed Rejection of Underspecified Vibe Prompts", () => {
    const core = new EosAgenticHarnessYieldCore();

    const completeSpec = core.assertSpecReadiness({
      taskId: "TASK-SDD-READY",
      earsRequirements: 5,
      bddScenarios: 6,
      adrCount: 3,
      hasFormalTlaModel: true,
      ambiguityScore: 0.04,
    });
    assert.strictEqual(completeSpec.approved, true);
    assert.ok(completeSpec.readinessScore >= 98);
    assert.strictEqual(completeSpec.missingCriteria.length, 0);

    // Underspecified vibe prompt must be rejected with HARNESS_SPEC_INCOMPLETE
    assert.throws(
      () =>
        core.assertSpecReadiness({
          taskId: "VIBE-PROMPT-01",
          earsRequirements: 0,
          bddScenarios: 0,
          adrCount: 0,
          hasFormalTlaModel: false,
          ambiguityScore: 0.65,
        }),
      (err) => err instanceof HarnessError && err.code === "HARNESS_SPEC_INCOMPLETE",
    );

    // Spec with excessive ambiguity (> 0.15) is also blocked fail-closed
    const highAmbiguity = core.evaluateSpecReadiness({
      taskId: "AMBIGUOUS-02",
      earsRequirements: 2,
      bddScenarios: 2,
      adrCount: 1,
      hasFormalTlaModel: false,
      ambiguityScore: 0.25,
    });
    assert.strictEqual(highAmbiguity.approved, false);
    assert.ok(highAmbiguity.missingCriteria.includes("AMBIGUITY_ABOVE_THRESHOLD"));
  });

  await t.test("BDD-1810: Multi-Stage Harness Validation Loop & Bounded Self-Repair Convergence", () => {
    const core = new EosAgenticHarnessYieldCore();
    const spec = {
      taskId: "HARNESS-PR-101",
      earsRequirements: 4,
      bddScenarios: 5,
      adrCount: 2,
      hasFormalTlaModel: true,
      ambiguityScore: 0.05,
    };

    const firstPass = core.runHarnessLoop({ spec, maxRetries: 3 });
    assert.strictEqual(firstPass.prReady, true);
    assert.strictEqual(firstPass.firstPassSuccess, true);
    assert.strictEqual(firstPass.totalRetries, 0);
    assert.strictEqual(firstPass.reworkTokens, 0);
    assert.strictEqual(firstPass.reworkAmplificationFactor, 1);
    assert.deepStrictEqual(firstPass.stagesExecuted, [...ORDERED_HARNESS_STAGES]);

    const repairedPass = core.runHarnessLoop({
      spec,
      maxRetries: 3,
      stageFailures: { TYPECHECK: 1, UNIT_BDD: 1 },
    });
    assert.strictEqual(repairedPass.prReady, true);
    assert.strictEqual(repairedPass.firstPassSuccess, false);
    assert.strictEqual(repairedPass.totalRetries, 2);
    assert.ok(repairedPass.reworkTokens > 0);
    assert.strictEqual(repairedPass.totalTokens, repairedPass.firstPassTokens + repairedPass.reworkTokens);
    assert.ok(repairedPass.reworkAmplificationFactor > 1.0);
  });

  await t.test("BDD-1811: Circuit-Breaker Halt When Repair Iterations Exceed Retry Budget", () => {
    const core = new EosAgenticHarnessYieldCore();
    const spec = {
      taskId: "HARNESS-OVER-BUDGET",
      earsRequirements: 3,
      bddScenarios: 3,
      adrCount: 1,
      hasFormalTlaModel: true,
      ambiguityScore: 0.05,
    };

    assert.throws(
      () =>
        core.runHarnessLoop({
          spec,
          maxRetries: 2,
          stageFailures: { UNIT_BDD: 2, FORMAL_TLC: 1 },
        }),
      (err) => err instanceof HarnessError && err.code === "HARNESS_MAX_RETRIES_EXCEEDED",
    );
  });

  await t.test("BDD-1812: First-Pass PR Yield (FPY), Rework Amplification Factor & FinOps Accounting", () => {
    const core = new EosAgenticHarnessYieldCore();
    const summary = core.evaluateCohortTelemetry([
      {
        prId: "PR-1",
        methodology: "SDD_HARNESS",
        firstPassSuccess: true,
        retries: 0,
        firstPassTokens: 7200,
        reworkTokens: 0,
        totalTokens: 7200,
        costUsd: 0.0216,
      },
      {
        prId: "PR-2",
        methodology: "SDD_HARNESS",
        firstPassSuccess: true,
        retries: 0,
        firstPassTokens: 7200,
        reworkTokens: 0,
        totalTokens: 7200,
        costUsd: 0.0216,
      },
      {
        prId: "PR-3",
        methodology: "SDD_HARNESS",
        firstPassSuccess: false,
        retries: 1,
        firstPassTokens: 7200,
        reworkTokens: 3600,
        totalTokens: 10800,
        costUsd: 0.0324,
      },
    ]);

    assert.strictEqual(summary.cohortSize, 3);
    assert.strictEqual(summary.firstPassCount, 2);
    assert.ok(Math.abs(summary.firstPassYieldRatio - 2 / 3) < 1e-5);
    assert.strictEqual(summary.wastedReworkTokens, 3600);
    assert.strictEqual(summary.totalTokens, 25200);
    assert.ok(Math.abs(summary.meanReworkAmplificationFactor - 25200 / 21600) < 1e-5);
  });

  await t.test("BDD-1813: Comparative Cohort Benchmark — Spec-Driven Harness vs Vibe Coding", () => {
    const core = new EosAgenticHarnessYieldCore();
    const bench = core.compareSddVsVibeCohorts();

    assert.ok(bench.sddCohort.firstPassYieldRatio > bench.vibeCohort.firstPassYieldRatio);
    assert.ok(bench.sddCohort.meanReworkAmplificationFactor < bench.vibeCohort.meanReworkAmplificationFactor);
    assert.ok(bench.yieldUpliftRatio > 0.5);
    assert.ok(bench.rafReductionRatio > 0.5);
    assert.ok(bench.tokenSavingsRatio > 0.5);
    assert.ok(bench.costSavingsUsd > 0);
  });

  await t.test("BDD-1814: Deterministic Audit Receipt & Parameter Validation", () => {
    const core = new EosAgenticHarnessYieldCore();
    const receiptA = core.audit();
    const receiptB = core.audit();

    assert.strictEqual(receiptA.specRef, "SPEC-339");
    assert.strictEqual(receiptA.specGateEnforced, true);
    assert.strictEqual(receiptA.harnessLoopConverged, true);
    assert.strictEqual(receiptA.retryCeilingEnforced, true);
    assert.strictEqual(receiptA.firstPassYieldComputed, true);
    assert.strictEqual(receiptA.sddOutperformsVibe, true);
    assert.strictEqual(receiptA.allPassed, true);
    assert.strictEqual(receiptA.sha256Digest.length, 64);
    assert.strictEqual(receiptA.sha256Digest, receiptB.sha256Digest);

    assert.throws(
      () =>
        core.evaluateSpecReadiness({
          earsRequirements: -1,
          bddScenarios: 1,
          adrCount: 1,
          hasFormalTlaModel: false,
          ambiguityScore: 0.1,
        }),
      (err) => err instanceof HarnessError && err.code === "HARNESS_INVALID_PARAMETERS",
    );

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receiptA, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
