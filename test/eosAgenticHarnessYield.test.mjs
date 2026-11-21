/**
 * @file eosAgenticHarnessYield.test.mjs
 * @description BDD test suite for SPEC-339 / CHANGE-201: Agentic Harness Engineering,
 * First-Pass PR Yield & Token Rework Telemetry Engine (BDD-1809..1814).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  EosAgenticHarnessYieldCore,
  HarnessError,
  MAX_ARCHITECTURE_SHARED_MEMORY_LINES,
  MAX_SPEC_AMBIGUITY,
  MIN_SPEC_READINESS_SCORE,
  ORDERED_HARNESS_STAGES,
} from "../src/core/eosAgenticHarnessYield.ts";

const RECEIPT_PATH = path.join(os.tmpdir(), `eos-test-AGENTIC_HARNESS_YIELD_RECEIPT-${process.pid}.json`);

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
    assert.strictEqual(receiptA.storyEnrichmentVerified, true);
    assert.strictEqual(receiptA.smartSpecMultiAgentVerified, true);
    assert.strictEqual(receiptA.rtkTokenCompressionVerified, true);
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

  await t.test("BDD-1814B: Mutation-Hardening Boundary, Error Contract & FinOps Accounting", () => {
    const core = new EosAgenticHarnessYieldCore();
    assert.strictEqual(MIN_SPEC_READINESS_SCORE, 80);
    assert.strictEqual(MAX_SPEC_AMBIGUITY, 0.15);

    // Exact rounding precision at 6 decimals (not 7)
    const precisionLoop = core.runHarnessLoop({
      spec: {
        taskId: "   ",
        earsRequirements: 1,
        bddScenarios: 1,
        adrCount: 1,
        hasFormalTlaModel: true,
        ambiguityScore: 0,
      },
      firstPassStageTokens: { TYPECHECK: 1, LINT_FORMAT: 1, UNIT_BDD: 1, FORMAL_TLC: 1, SECURITY_HYGIENE: 1 },
      repairTokensPerRetry: 0,
      tokenCostPer1kUsd: 0.333333,
    });
    assert.strictEqual(precisionLoop.taskId, "task-unnamed");
    assert.strictEqual(precisionLoop.firstPassTokens, 5);
    assert.strictEqual(precisionLoop.estimatedCostUsd, 0.001667);

    // Exact boundary ambiguity 0, 0.15, 1.0 (valid) vs 1.5 (throws)
    const zeroAmb = core.evaluateSpecReadiness({
      taskId: "AMB-0",
      earsRequirements: 1,
      bddScenarios: 1,
      adrCount: 1,
      hasFormalTlaModel: true,
      ambiguityScore: 0,
    });
    assert.strictEqual(zeroAmb.readinessScore, 100);
    assert.strictEqual(zeroAmb.approved, true);

    const exactAmbThreshold = core.evaluateSpecReadiness({
      taskId: "AMB-15",
      earsRequirements: 1,
      bddScenarios: 1,
      adrCount: 1,
      hasFormalTlaModel: false,
      ambiguityScore: 0.15,
    });
    assert.strictEqual(exactAmbThreshold.readinessScore, 82);
    assert.strictEqual(exactAmbThreshold.missingCriteria.length, 0);

    const exactly80 = core.evaluateSpecReadiness({
      taskId: "SCORE-80",
      earsRequirements: 1,
      bddScenarios: 1,
      adrCount: 1,
      hasFormalTlaModel: false,
      ambiguityScore: 0.25,
    });
    assert.strictEqual(exactly80.readinessScore, 80);
    assert.deepStrictEqual(exactly80.missingCriteria, ["AMBIGUITY_ABOVE_THRESHOLD"]);

    const oneAmb = core.evaluateSpecReadiness({
      taskId: "AMB-1",
      earsRequirements: 1,
      bddScenarios: 1,
      adrCount: 1,
      hasFormalTlaModel: false,
      ambiguityScore: 1,
    });
    assert.strictEqual(oneAmb.readinessScore, 65);
    assert.ok(oneAmb.missingCriteria.includes("READINESS_SCORE_BELOW_80"));

    const allMissing = core.evaluateSpecReadiness({
      taskId: "NONE",
      earsRequirements: 0,
      bddScenarios: 0,
      adrCount: 0,
      hasFormalTlaModel: false,
      ambiguityScore: 0,
    });
    assert.strictEqual(allMissing.readinessScore, 20);
    assert.deepStrictEqual(allMissing.missingCriteria, [
      "EARS_REQUIREMENTS_MISSING",
      "BDD_SCENARIOS_MISSING",
      "ADR_DECISION_MISSING",
      "READINESS_SCORE_BELOW_80",
    ]);

    assert.throws(
      () =>
        core.evaluateSpecReadiness({
          earsRequirements: 1,
          bddScenarios: 1,
          adrCount: 1,
          hasFormalTlaModel: false,
          ambiguityScore: 1.5,
        }),
      (err) =>
        err instanceof HarnessError && err.name === "HarnessError" && err.message.includes("invalid specification"),
    );

    assert.throws(
      () =>
        core.assertSpecReadiness({
          earsRequirements: 0,
          bddScenarios: 1,
          adrCount: 1,
          hasFormalTlaModel: false,
          ambiguityScore: 0.5,
        }),
      (err) => err instanceof HarnessError && err.message.includes(", AMBIGUITY_ABOVE_THRESHOLD"),
    );

    // Default tokens, durations, attempts, maxRetries boundary (0, 3, 50 accepted; 51 throws)
    const nominalDefaults = core.runHarnessLoop({
      spec: {
        taskId: "DEF",
        earsRequirements: 1,
        bddScenarios: 1,
        adrCount: 1,
        hasFormalTlaModel: true,
        ambiguityScore: 0,
      },
    });
    assert.strictEqual(nominalDefaults.firstPassTokens, 7200);
    assert.strictEqual(nominalDefaults.estimatedCostUsd, 0.0216);
    assert.deepStrictEqual(
      nominalDefaults.attempts.map((a) => a.durationMs),
      [950, 620, 1850, 2400, 780],
    );
    assert.deepStrictEqual(
      nominalDefaults.attempts.map((a) => [a.attempt, a.passed, a.reworkTokens, a.tokensConsumed]),
      [
        [1, true, 0, 1200],
        [1, true, 0, 800],
        [1, true, 0, 2400],
        [1, true, 0, 1800],
        [1, true, 0, 1000],
      ],
    );

    const exactRetries = core.runHarnessLoop({
      spec: {
        taskId: "R3",
        earsRequirements: 1,
        bddScenarios: 1,
        adrCount: 1,
        hasFormalTlaModel: true,
        ambiguityScore: 0,
      },
      stageFailures: { TYPECHECK: 2 },
    });
    assert.strictEqual(exactRetries.totalRetries, 2);
    assert.strictEqual(exactRetries.reworkTokens, 6800);
    assert.deepStrictEqual(exactRetries.attempts.slice(0, 3), [
      { stage: "TYPECHECK", attempt: 1, passed: false, tokensConsumed: 1200, reworkTokens: 0, durationMs: 950 },
      { stage: "TYPECHECK", attempt: 2, passed: false, tokensConsumed: 3400, reworkTokens: 3400, durationMs: 1093 },
      { stage: "TYPECHECK", attempt: 3, passed: true, tokensConsumed: 3400, reworkTokens: 3400, durationMs: 1093 },
    ]);

    assert.strictEqual(
      core.runHarnessLoop({
        spec: {
          taskId: "R0",
          earsRequirements: 1,
          bddScenarios: 1,
          adrCount: 1,
          hasFormalTlaModel: true,
          ambiguityScore: 0,
        },
        maxRetries: 0,
      }).prReady,
      true,
    );
    assert.strictEqual(
      core.runHarnessLoop({
        spec: {
          taskId: "R50",
          earsRequirements: 1,
          bddScenarios: 1,
          adrCount: 1,
          hasFormalTlaModel: true,
          ambiguityScore: 0,
        },
        maxRetries: 50,
      }).prReady,
      true,
    );

    assert.throws(() => core.runHarnessLoop(null), /HARNESS_INVALID_PARAMETERS.*spec is required/);
    assert.throws(
      () =>
        core.runHarnessLoop({
          spec: {
            taskId: "R51",
            earsRequirements: 1,
            bddScenarios: 1,
            adrCount: 1,
            hasFormalTlaModel: true,
            ambiguityScore: 0,
          },
          maxRetries: 51,
        }),
      /HARNESS_INVALID_PARAMETERS.*invalid retry or FinOps/,
    );
    assert.throws(
      () =>
        core.runHarnessLoop({
          spec: {
            taskId: "NEG",
            earsRequirements: 1,
            bddScenarios: 1,
            adrCount: 1,
            hasFormalTlaModel: true,
            ambiguityScore: 0,
          },
          repairTokensPerRetry: -1,
        }),
      /HARNESS_INVALID_PARAMETERS.*invalid retry or FinOps/,
    );
    assert.throws(
      () =>
        core.runHarnessLoop({
          spec: {
            taskId: "BADSTAGE",
            earsRequirements: 1,
            bddScenarios: 1,
            adrCount: 1,
            hasFormalTlaModel: true,
            ambiguityScore: 0,
          },
          firstPassStageTokens: { TYPECHECK: 0 },
        }),
      /HARNESS_INVALID_PARAMETERS.*invalid token budget/,
    );
    assert.throws(
      () =>
        core.runHarnessLoop({
          spec: {
            taskId: "NEGFAIL",
            earsRequirements: 1,
            bddScenarios: 1,
            adrCount: 1,
            hasFormalTlaModel: true,
            ambiguityScore: 0,
          },
          stageFailures: { TYPECHECK: -1 },
        }),
      /HARNESS_INVALID_PARAMETERS.*negative failure count/,
    );

    // Cohort edge boundaries & default canonical cohorts
    assert.throws(() => core.evaluateCohortTelemetry([]), /HARNESS_INVALID_PARAMETERS.*non-empty/);
    assert.throws(
      () =>
        core.evaluateCohortTelemetry([
          {
            prId: "X",
            methodology: "SDD_HARNESS",
            firstPassSuccess: true,
            retries: 0,
            firstPassTokens: 100,
            reworkTokens: 0,
            totalTokens: 50,
            costUsd: 0,
          },
        ]),
      /HARNESS_INVALID_PARAMETERS.*invalid telemetry record X/,
    );
    const singleZeroCost = core.evaluateCohortTelemetry([
      {
        prId: "SINGLE",
        methodology: "SDD_HARNESS",
        firstPassSuccess: true,
        retries: 0,
        firstPassTokens: 1,
        reworkTokens: 0,
        totalTokens: 1,
        costUsd: 0,
      },
    ]);
    assert.strictEqual(singleZeroCost.totalCostUsd, 0);
    assert.strictEqual(singleZeroCost.firstPassTokens, 1);

    // Canonical cohorts & partial override fallback (sddRecords only -> uses buildCanonicalBenchmarkCohorts)
    const cohorts = core.buildCanonicalBenchmarkCohorts();
    assert.deepStrictEqual(
      cohorts.sdd.map((r) => [r.prId, r.methodology, r.retries, r.totalTokens, r.costUsd]),
      [
        ["PR-SDD-01", "SDD_HARNESS", 0, 7200, 0.0216],
        ["PR-SDD-02", "SDD_HARNESS", 0, 7200, 0.0216],
        ["PR-SDD-03", "SDD_HARNESS", 1, 10400, 0.0312],
        ["PR-SDD-04", "SDD_HARNESS", 0, 7200, 0.0216],
        ["PR-SDD-05", "SDD_HARNESS", 0, 7200, 0.0216],
      ],
    );
    assert.deepStrictEqual(
      cohorts.vibe.map((r) => [r.prId, r.methodology, r.retries]),
      [
        ["PR-VIBE-01", "VIBE_CODING", 3],
        ["PR-VIBE-02", "VIBE_CODING", 2],
        ["PR-VIBE-03", "VIBE_CODING", 4],
        ["PR-VIBE-04", "VIBE_CODING", 3],
        ["PR-VIBE-05", "VIBE_CODING", 2],
      ],
    );
    const partialOverrideBench = core.compareSddVsVibeCohorts([cohorts.sdd[0]]);
    assert.strictEqual(partialOverrideBench.sddCohort.cohortSize, 5);
  });

  await t.test("BDD-1814C: Idempotent /enrich-us Gate, Ambiguity Blocking & 4-Category Playwright QA Catalog", () => {
    const core = new EosAgenticHarnessYieldCore();
    const skipped = core.enrichUserStory({
      ticketId: "PER-101",
      title: "Already Enriched Ticket",
      rawStory: "[original]\nFilter list\n[enhanced]\nStrict spec contract",
    });
    assert.strictEqual(skipped.status, "SKIPPED_ALREADY_ENRICHED");
    assert.strictEqual(skipped.targetJiraStatus, "Unchanged");

    const forced = core.enrichUserStory({
      ticketId: "PER-101",
      title: "Re-enriched Clean Ticket",
      rawStory: "## Original\nOld\n## Enhanced\nAllow filtering candidates by stage.",
      affectedLayers: ["BACKEND"],
      forceReEnrich: true,
    });
    assert.strictEqual(forced.status, "ENRICHED");
    assert.strictEqual(forced.decisionsClosed, true);
    assert.strictEqual(forced.targetJiraStatus, "Pending refinement validation");
    assert.strictEqual(forced.playwrightQaCatalog.length, 0);

    const blocked = core.enrichUserStory({
      ticketId: "PER-102",
      title: "Frontend Candidate Table",
      rawStory: "Add status filter si aplica y además export CSV if needed.",
      affectedLayers: ["BACKEND", "FRONTEND"],
    });
    assert.strictEqual(blocked.status, "BLOCKED_ON_CLARIFICATIONS");
    assert.strictEqual(blocked.decisionsClosed, false);
    assert.strictEqual(blocked.targetJiraStatus, "To refine");
    assert.ok(blocked.forbiddenHedgesFound.includes("si aplica"));
    assert.ok(blocked.forbiddenHedgesFound.includes("if needed"));
    assert.ok(blocked.compoundCriteriaFound.length >= 1);
    assert.ok(blocked.blockingQuestions.length >= 3);
    assert.deepStrictEqual(
      blocked.playwrightQaCatalog.map((q) => q.category),
      ["HAPPY_PATH", "BOUNDARY", "NEGATIVE", "BUSINESS_RULE"],
    );
    assert.ok(blocked.mandatoryVerificationSteps.some((s) => s.includes("Playwright MCP")));
    assert.throws(
      () => core.enrichUserStory({ ticketId: "", title: "X", rawStory: "Y" }),
      (err) => err instanceof HarnessError && err.code === "HARNESS_INVALID_PARAMETERS",
    );
  });

  await t.test("BDD-1814D: 4-Agent Smart Spec, Cheap Execution & <=200-Line Architecture Shared Memory", () => {
    const core = new EosAgenticHarnessYieldCore();
    assert.strictEqual(MAX_ARCHITECTURE_SHARED_MEMORY_LINES, 200);
    const compliant = core.planSmartSpecCheapExecution({ architectureDocLines: 180 });
    assert.strictEqual(compliant.architectureMemoryCompliant, true);
    assert.deepStrictEqual(
      compliant.roles.map((r) => [r.role, r.modelTier]),
      [
        ["REFINER", "FRONTIER_HIGH_REASONING"],
        ["ARCHITECT_PLANNER", "FRONTIER_HIGH_REASONING"],
        ["IMPLEMENTER", "FAST_EXECUTION"],
        ["INDEPENDENT_REVIEWER", "FAST_EXECUTION"],
      ],
    );
    assert.ok(compliant.costSavingsRatio > 0.5);
    assert.ok(compliant.tokenSavingsRatio > 0.5);

    const oversized = core.planSmartSpecCheapExecution({ architectureDocLines: 240 });
    assert.strictEqual(oversized.architectureMemoryCompliant, false);
    assert.throws(
      () => core.planSmartSpecCheapExecution({ architectureDocLines: 0 }),
      (err) => err instanceof HarnessError && err.code === "HARNESS_INVALID_PARAMETERS",
    );
  });

  await t.test("BDD-1814E: RTK CLI Output Token Compression & Sovereign CLI JSON Dispatch", () => {
    const core = new EosAgenticHarnessYieldCore();
    const esc = String.fromCharCode(27);
    for (const commandType of ["test", "git", "grep"]) {
      const routine = Array.from({ length: 50 }, (_, i) => `${esc}[32m  ✔ routine line #${i + 1} ok${esc}[0m`).join(
        "\n",
      );
      const rawOutput = `${routine}\nFAIL: critical defect in src/app.ts:88\nmodified: src/app.ts`;
      const report = core.compressCliOutputRtk({ commandType, rawOutput });
      assert.strictEqual(report.targetBandMet, true, `${commandType} missed >=60% compression`);
      assert.ok(report.savingsPercent >= 60);
      assert.ok(report.compressedOutput.includes("FAIL: critical defect"));
      assert.ok(!report.compressedOutput.includes(`${esc}[32m`));
    }
    assert.throws(
      () => core.compressCliOutputRtk({ commandType: "invalid", rawOutput: "abc" }),
      (err) => err instanceof HarnessError && err.code === "HARNESS_INVALID_PARAMETERS",
    );

    const cliPath = path.resolve(process.cwd(), "bin/eos.mjs");
    const enrichJson = JSON.parse(
      execFileSync(process.execPath, [cliPath, "toolchain:harness:enrich", "--json"], { encoding: "utf8" }),
    );
    assert.strictEqual(enrichJson.command, "toolchain:harness:enrich");
    assert.strictEqual(enrichJson.status, "ENRICHED");

    const multiJson = JSON.parse(
      execFileSync(process.execPath, [cliPath, "toolchain:harness:multiagent", "--json"], { encoding: "utf8" }),
    );
    assert.strictEqual(multiJson.command, "toolchain:harness:multiagent");
    assert.strictEqual(multiJson.architectureMemoryCompliant, true);

    const rtkJson = JSON.parse(
      execFileSync(process.execPath, [cliPath, "toolchain:harness:rtk", "--json"], { encoding: "utf8" }),
    );
    assert.strictEqual(rtkJson.command, "toolchain:harness:rtk");
    assert.strictEqual(rtkJson.targetBandMet, true);
  });
});
