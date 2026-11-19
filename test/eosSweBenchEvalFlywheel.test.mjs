/**
 * @file eosSweBenchEvalFlywheel.test.mjs
 * @description Automated test suite for SPEC-366 / CHANGE-228: SWE-Bench Autonomous Evaluation Harness & Fleet Eval Flywheel.
 *
 * Verifies BDD-1975 through BDD-1980:
 * - BDD-1975: Evaluation Task Staging & Pre-Condition Sandboxing
 * - BDD-1976: Candidate Patch Application & Oracle Grading
 * - BDD-1977: Synthetic Eval Mining from Fleet Git Repositories
 * - BDD-1978: Statistical pass@k & Cost Scorecard Calculation
 * - BDD-1979: Timeout and Resource Circuit Breaker Enforcement
 * - BDD-1980: Full Diagnostic Audit & Eval Flywheel Receipt
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { EosSweBenchEvalFlywheel, SWE_BENCH_FLEET_REPOS } from "../src/core/eosSweBenchEvalFlywheel.ts";

test("BDD-1975: Evaluation Task Staging & Pre-Condition Sandboxing", () => {
  const flywheel = new EosSweBenchEvalFlywheel();

  const challenge = {
    taskId: "EVAL-TEST-001",
    targetRepo: "eos-system",
    problemStatement: "Fix memory leak in ring-buffer telemetry drain",
    baseCommit: "commit-base-sha-1234",
    failToPassTests: ["test/drain.test.mjs"],
    passToPassTests: ["test/sanity.test.mjs"],
  };

  const staged = flywheel.stageChallenge(challenge);
  assert.equal(staged.success, true);
  assert.equal(staged.sandboxDigest.length, 64);
  assert.equal(flywheel.getTaskStatus("EVAL-TEST-001"), "STAGED");
});

test("BDD-1976: Candidate Patch Application & Oracle Grading", () => {
  const flywheel = new EosSweBenchEvalFlywheel();

  const challenge = {
    taskId: "EVAL-TEST-002",
    targetRepo: "portafolio",
    problemStatement: "Prevent horizontal scrollbar overflow on mobile viewports",
    baseCommit: "commit-base-portfolio-9876",
    failToPassTests: ["test/viewport.test.mjs"],
    passToPassTests: ["test/routes.test.mjs"],
  };

  flywheel.stageChallenge(challenge);

  const patch = {
    patchId: "PATCH-002",
    taskId: "EVAL-TEST-002",
    diffContent: "--- a/style.css\n+++ b/style.css\n@@ -1,1 +1,2 @@\n+overflow-x: hidden;\n",
    generatedAt: Date.now(),
    tokenCost: 1100,
  };

  const applied = flywheel.applyPatch(patch);
  assert.equal(applied.success, true);
  assert.ok(applied.patchLines > 0);
  assert.equal(flywheel.getTaskStatus("EVAL-TEST-002"), "PATCHED");

  const graded = flywheel.gradeTask("EVAL-TEST-002", {
    failToPassResolved: true,
    passToPassPreserved: true,
    durationMs: 14,
  });

  assert.equal(graded.status, "RESOLVED");
  assert.equal(graded.exitCode, 0);
  assert.equal(graded.testResults.failToPassResolved, true);
  assert.equal(graded.testResults.passToPassPreserved, true);
  assert.equal(flywheel.getTaskStatus("EVAL-TEST-002"), "RESOLVED");
});

test("BDD-1977: Synthetic Eval Mining from Fleet Git Repositories", () => {
  const flywheel = new EosSweBenchEvalFlywheel();

  const synthetic = flywheel.mineChallengeFromGit({
    sourceRepo: "atp-strength",
    commitHash: "git-commit-hash-atp-5544",
    problemStatement: "Fix workout progression arithmetic rounding error in sets counter",
    testFile: "test/workout.test.mjs",
    resolutionDiff: "+ const rounded = Math.round(weight * 10) / 10;",
  });

  assert.ok(synthetic.taskId.startsWith("EVAL-SYNTH-"));
  assert.equal(synthetic.targetRepo, "atp-strength");
  assert.equal(synthetic.failToPassTests[0], "test/workout.test.mjs");
  assert.equal(flywheel.getTaskStatus(synthetic.taskId), "STAGED");
});

test("BDD-1978: Statistical pass@k & Cost Scorecard Calculation", () => {
  const flywheel = new EosSweBenchEvalFlywheel();

  // Test standard HumanEval combinatoric formula:
  // n=5, c=5 -> pass@1=1.0, pass@3=1.0, pass@5=1.0
  const perfectScore = EosSweBenchEvalFlywheel.calculatePassAtK(5, 5, 1);
  assert.equal(perfectScore, 1.0);

  // n=5, c=0 -> pass@1=0.0
  const zeroScore = EosSweBenchEvalFlywheel.calculatePassAtK(5, 0, 1);
  assert.equal(zeroScore, 0.0);

  // n=10, c=5 -> pass@1 = 1 - (5/10) = 0.5
  const halfScore = EosSweBenchEvalFlywheel.calculatePassAtK(10, 5, 1);
  assert.equal(halfScore, 0.5);

  const scorecard = flywheel.computeScorecard(5);
  assert.equal(typeof scorecard.passAt1, "number");
  assert.equal(typeof scorecard.passAt3, "number");
  assert.equal(typeof scorecard.passAt5, "number");
  assert.ok(scorecard.meanTokenCost > 0);
  assert.ok(scorecard.meanLatencyMs >= 0);
});

test("BDD-1979: Timeout and Resource Circuit Breaker Enforcement", () => {
  const flywheel = new EosSweBenchEvalFlywheel();

  const challenge = {
    taskId: "EVAL-TIMEOUT-001",
    targetRepo: "crud-slack",
    problemStatement: "Reconnection loop backoff test",
    baseCommit: "commit-base-slack-3322",
    failToPassTests: ["test/reconnect.test.mjs"],
    passToPassTests: ["test/sanity.test.mjs"],
  };

  flywheel.stageChallenge(challenge);

  // Under limit -> passes
  const underLimit = flywheel.enforceExecutionLimit("EVAL-TIMEOUT-001", 30000, 60000);
  assert.equal(underLimit, true);

  // Exceeds limit -> tripped
  const overLimit = flywheel.enforceExecutionLimit("EVAL-TIMEOUT-001", 65000, 60000);
  assert.equal(overLimit, false);
  assert.equal(flywheel.getTaskStatus("EVAL-TIMEOUT-001"), "TIMEOUT");
});

test("BDD-1980: Full Diagnostic Audit & Eval Flywheel Receipt", async () => {
  const receipt = await EosSweBenchEvalFlywheel.audit();

  assert.equal(receipt.specId, "SPEC-366");
  assert.equal(receipt.changeId, "CHANGE-228");
  assert.equal(receipt.fleetEvaluatedReposCount, SWE_BENCH_FLEET_REPOS.length);
  assert.equal(receipt.checks.hermeticSandboxing, "PASS");
  assert.equal(receipt.checks.oracleGradingIntegrity, "PASS");
  assert.equal(receipt.checks.syntheticChallengeMining, "PASS");
  assert.equal(receipt.checks.passAtKStatisticalRigor, "PASS");
  assert.equal(receipt.checks.circuitBreakerEnforcement, "PASS");
  assert.equal(receipt.checks.zeroDependencyPurity, "PASS");
  assert.equal(receipt.integrityHash.length, 64);
});
