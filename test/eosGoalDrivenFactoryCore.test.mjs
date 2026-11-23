/**
 * @file eosGoalDrivenFactoryCore.test.mjs
 * @description Verifies SPEC-378 / CHANGE-240 (BDD-2057..BDD-2064):
 * Goal-Driven Development Loop, Immutable Verifier Guard, Parallel Worktree
 * Software Factory & 3-Gate Pre-PR Engine.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EosGoalDrivenFactoryCore,
  evaluatePrePrGates,
  planSoftwareFactoryRun,
  runBoundedGoalLoop,
  validateGoalContract,
  verifyVerifierIntegrity,
} from "../src/core/eosGoalDrivenFactoryCore.ts";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";
import { PHASE8_TOOL_DEFINITIONS } from "../src/mcp/tools/eosMcpPhase8ToolDefinitions.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const CONCRETE_OUTPUT_GOAL = {
  goalId: "BDD-GOAL-378",
  kind: "OUTPUT",
  description: "List endpoint responds under 200 ms with 10000 rows",
  metricName: "p95LatencyMs",
  operator: "<",
  threshold: 200,
  unit: "ms",
  verifyCommand: "node scripts/bench-list.mjs",
  maxAttempts: 3,
  maxDurationMs: 120_000,
  maxCostUsd: 2.5,
  maxTotalTokens: 50_000,
};

describe("SPEC-378: Goal-Driven Development Loop, Immutable Verifier & Parallel Factory", () => {
  it("BDD-2057: Rejects vague prose goals & premature same-day outcome closure while accepting concrete output contracts", () => {
    const vague = validateGoalContract({
      goalId: "G-VAGUE",
      kind: "OUTPUT",
      description: "improve list performance",
      metricName: "faster response",
      operator: "<",
      threshold: Number.NaN,
      unit: "",
      verifyCommand: "",
      maxAttempts: 0,
      maxDurationMs: -1,
      maxCostUsd: 0,
    });
    assert.equal(vague.valid, false);
    assert.equal(vague.verdict, "REJECTED_VAGUE_GOAL");
    const vagueCodes = new Set(vague.violations.map((v) => v.code));
    assert.ok(vagueCodes.has("VAGUE_GOAL_PROSE"));
    assert.ok(vagueCodes.has("NON_FINITE_THRESHOLD"));
    assert.ok(vagueCodes.has("MISSING_VERIFY_COMMAND"));
    assert.ok(vagueCodes.has("UNBOUNDED_COST"));

    const prematureOutcome = validateGoalContract({
      ...CONCRETE_OUTPUT_GOAL,
      goalId: "G-OUTCOME-EARLY",
      kind: "OUTCOME",
      outcomeFollowUp: { metricsSource: "mixpanel", reviewAfterDays: 3, decisionOwner: "product" },
    });
    assert.equal(prematureOutcome.valid, false);
    assert.equal(prematureOutcome.sameDayClosable, false);
    assert.ok(prematureOutcome.violations.some((v) => v.code === "OUTCOME_PREMATURE_REVIEW"));

    const validOutput = validateGoalContract(CONCRETE_OUTPUT_GOAL);
    assert.equal(validOutput.valid, true);
    assert.equal(validOutput.verdict, "VALID");
    assert.equal(validOutput.sameDayClosable, true);
    assert.match(validOutput.attestationHash, /^[0-9a-f]{64}$/);
  });

  it("BDD-2058: Immutable verifier guard blocks test, workflow, spec, and digest mutations", () => {
    const blocked = verifyVerifierIntegrity({
      changedFiles: ["src/core/billing.ts", "test/eosCore.test.mjs", ".github/workflows/eos-sovereign-cicd.yml"],
      beforeDigests: { "scripts/verify-strict.mjs": "abc123" },
      afterDigests: { "scripts/verify-strict.mjs": "tampered999" },
    });
    assert.equal(blocked.verifierIntact, false);
    assert.equal(blocked.verdict, "HARD_BLOCK_TAMPERED");
    const codes = new Set(blocked.violations.map((v) => v.code));
    assert.ok(codes.has("PROTECTED_VERIFIER_MUTATION"));
    assert.ok(codes.has("VERIFIER_DIGEST_DRIFT"));

    const clean = verifyVerifierIntegrity({ changedFiles: ["./src/core/billing.ts"] });
    assert.equal(clean.verifierIntact, true);
    assert.equal(clean.verdict, "VERIFIER_INTACT");
    assert.deepEqual(clean.violations, []);
    assert.match(clean.attestationHash, /^[0-9a-f]{64}$/);
  });

  it("BDD-2059: Bounded loop converges on output verification and halts on tampered verifier or budget caps", () => {
    const converging = runBoundedGoalLoop({
      goal: CONCRETE_OUTPUT_GOAL,
      attempts: [
        {
          attemptNumber: 1,
          durationMs: 1200,
          costUsd: 0.4,
          tokensUsed: 4000,
          observedValue: 265,
          commandExitCode: 1,
          summary: "Add cache index",
        },
        {
          attemptNumber: 2,
          durationMs: 1100,
          costUsd: 0.4,
          tokensUsed: 3500,
          observedValue: 145,
          commandExitCode: 0,
          summary: "Query < 200ms",
        },
      ],
    });
    assert.equal(converging.status, "GOAL_MET");
    assert.equal(converging.goalMet, true);
    assert.equal(converging.outcomeVerified, false);
    assert.equal(converging.deliveryClassification, "OUTPUT_VERIFIED");
    assert.equal(converging.attemptsExecuted, 2);

    const tampered = runBoundedGoalLoop({
      goal: CONCRETE_OUTPUT_GOAL,
      attempts: [
        {
          attemptNumber: 1,
          durationMs: 500,
          costUsd: 0.2,
          observedValue: 100,
          commandExitCode: 0,
          summary: "Modified assertion",
          changedFiles: ["test/eosCore.test.mjs"],
        },
      ],
    });
    assert.equal(tampered.status, "HALTED_VERIFIER_TAMPERED");
    assert.equal(tampered.goalMet, false);
    assert.equal(tampered.deliveryClassification, "BLOCKED_TAMPERED_VERIFIER");

    const runaway = runBoundedGoalLoop({
      goal: { ...CONCRETE_OUTPUT_GOAL, maxCostUsd: 1.0 },
      attempts: [
        {
          attemptNumber: 1,
          durationMs: 1000,
          costUsd: 0.6,
          observedValue: 250,
          commandExitCode: 1,
          summary: "Probe 1",
        },
        {
          attemptNumber: 2,
          durationMs: 1000,
          costUsd: 0.6,
          observedValue: 240,
          commandExitCode: 1,
          summary: "Probe 2",
        },
      ],
    });
    assert.equal(runaway.status, "HALTED_BUDGET_EXHAUSTED");
    assert.equal(runaway.stopReason, "MAX_COST_EXCEEDED");
    assert.equal(runaway.attemptLedger.length, 2);
  });

  it("BDD-2060: Parallel Software Factory blocks colliding worktrees/edit surfaces and plans bounded waves", () => {
    const colliding = planSoftwareFactoryRun({
      batchId: "FACTORY-COLLIDE",
      maxConcurrency: 2,
      totalMaxCostUsd: 10,
      tasks: [
        {
          taskId: "J-1",
          worktreePath: ".wt/shared",
          branchName: "fix/j1",
          editSurfacePaths: ["src/a.ts"],
          goal: CONCRETE_OUTPUT_GOAL,
        },
        {
          taskId: "J-2",
          worktreePath: ".wt/shared",
          branchName: "fix/j2",
          editSurfacePaths: ["src/a.ts"],
          goal: CONCRETE_OUTPUT_GOAL,
        },
      ],
    });
    assert.equal(colliding.verdict, "CONFLICT_BLOCKED");
    const codes = new Set(colliding.conflicts.map((c) => c.code));
    assert.ok(codes.has("WORKTREE_COLLISION"));
    assert.ok(codes.has("EDIT_SURFACE_OVERLAP"));

    const overBudget = planSoftwareFactoryRun({
      batchId: "FACTORY-OVERBUDGET",
      maxConcurrency: 2,
      totalMaxCostUsd: 3.0,
      tasks: [
        {
          taskId: "J-1",
          worktreePath: ".wt/1",
          branchName: "fix/j1",
          editSurfacePaths: ["src/a.ts"],
          goal: CONCRETE_OUTPUT_GOAL,
        },
        {
          taskId: "J-2",
          worktreePath: ".wt/2",
          branchName: "fix/j2",
          editSurfacePaths: ["src/b.ts"],
          goal: CONCRETE_OUTPUT_GOAL,
        },
      ],
    });
    assert.equal(overBudget.verdict, "FACTORY_BUDGET_EXCEEDED");

    const clean = planSoftwareFactoryRun({
      batchId: "FACTORY-CLEAN",
      maxConcurrency: 2,
      totalMaxCostUsd: 10,
      tasks: [
        {
          taskId: "J-1",
          worktreePath: ".wt/1",
          branchName: "fix/j1",
          editSurfacePaths: ["src/a.ts"],
          goal: CONCRETE_OUTPUT_GOAL,
        },
        {
          taskId: "J-2",
          worktreePath: ".wt/2",
          branchName: "fix/j2",
          editSurfacePaths: ["src/b.ts"],
          goal: CONCRETE_OUTPUT_GOAL,
        },
        {
          taskId: "J-3",
          worktreePath: ".wt/3",
          branchName: "fix/j3",
          editSurfacePaths: ["src/c.ts"],
          goal: CONCRETE_OUTPUT_GOAL,
        },
      ],
    });
    assert.equal(clean.verdict, "READY_FOR_FACTORY");
    assert.equal(clean.waves.length, 2);
    assert.equal(clean.waves[0].tasks.length, 2);
    assert.equal(clean.waves[1].tasks.length, 1);
  });

  it("BDD-2061: Three-Gate Pre-PR evaluator allows non-blocking warnings while blocking criticals and self-review", () => {
    const passWithAdvisories = evaluatePrePrGates({
      prId: "PR-CLEAN",
      testsExecuted: true,
      unitTestsPassed: true,
      e2eTestsPassed: true,
      implementerAgentId: "agent-impl",
      reviewerAgentId: "agent-adversarial",
      findings: [
        { id: "W-1", severity: "warning", summary: "Extract helper function" },
        { id: "S-1", severity: "suggestion", summary: "Clarify JSDoc wording" },
      ],
      verifyCommandExecuted: true,
      verifierIntact: true,
      incompleteTasks: 0,
    });
    assert.equal(passWithAdvisories.verdict, "READY_FOR_PR");
    assert.equal(passWithAdvisories.readyForPr, true);
    assert.equal(passWithAdvisories.nonBlockingFindings.length, 2);

    const blockedCritical = evaluatePrePrGates({
      prId: "PR-CRIT",
      testsExecuted: true,
      unitTestsPassed: true,
      e2eTestsPassed: true,
      implementerAgentId: "agent-impl",
      reviewerAgentId: "agent-adversarial",
      findings: [{ id: "C-1", severity: "critical", summary: "Missing authz guard" }],
      verifyCommandExecuted: true,
      verifierIntact: true,
      incompleteTasks: 0,
    });
    assert.equal(blockedCritical.verdict, "BLOCKED");
    assert.equal(blockedCritical.readyForPr, false);
    assert.equal(blockedCritical.gates.independentAdversarialReview, false);

    const blockedSelfReview = evaluatePrePrGates({
      prId: "PR-SELF",
      testsExecuted: true,
      unitTestsPassed: true,
      e2eTestsPassed: true,
      implementerAgentId: "agent-same",
      reviewerAgentId: "agent-same",
      findings: [],
      verifyCommandExecuted: true,
      verifierIntact: true,
      incompleteTasks: 0,
    });
    assert.equal(blockedSelfReview.verdict, "BLOCKED");
    assert.equal(blockedSelfReview.gates.independentAdversarialReview, false);
  });

  it("BDD-2062: CLI toolchain:gdd:* handlers execute cleanly and emit valid JSON", () => {
    const cliEntry = path.join(ROOT, "bin", "eos.mjs");
    const cmds = [
      ["toolchain:gdd:goal", "--json"],
      ["toolchain:gdd:verifier", "--json"],
      ["toolchain:gdd:loop", "--json"],
      ["toolchain:gdd:factory", "--json"],
      ["toolchain:gdd:gates", "--json"],
      ["toolchain:gdd:diff", "--json", "--advisory"],
      ["toolchain:gdd:audit", "--json"],
    ];

    for (const args of cmds) {
      const stdout = execFileSync(process.execPath, [cliEntry, ...args], {
        cwd: ROOT,
        encoding: "utf8",
      });
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.command, args[0]);
    }
  });

  it("BDD-2063: TLA+ Model 121 GoalDrivenFactory is defined and registered in scripts/run-tlc.mjs", () => {
    const tlaPath = path.join(ROOT, "docs", "formal", "GoalDrivenFactory.tla");
    const cfgPath = path.join(ROOT, "docs", "formal", "GoalDrivenFactory.cfg");
    const runTlc = fs.readFileSync(path.join(ROOT, "scripts", "run-tlc.mjs"), "utf8");

    assert.ok(fs.existsSync(tlaPath), "GoalDrivenFactory.tla must exist");
    assert.ok(fs.existsSync(cfgPath), "GoalDrivenFactory.cfg must exist");
    assert.ok(runTlc.includes('"GoalDrivenFactory"'), "scripts/run-tlc.mjs must register GoalDrivenFactory");
    const tlaText = fs.readFileSync(tlaPath, "utf8");
    assert.ok(tlaText.includes("SafetyNoReadyOnTamperedVerifier"));
    assert.ok(tlaText.includes("SafetyNoReadyWithoutPrePrGates"));
  });

  it("BDD-2064: EosGoalDrivenFactoryCore.audit() and Phase-8 MCP tool produce hermetic VERIFIED SHA-256 receipt", () => {
    const toolDef = PHASE8_TOOL_DEFINITIONS.find((t) => t.name === "eos_goal_driven_factory_audit");
    assert.ok(toolDef, "Phase-8 tool definition for eos_goal_driven_factory_audit must exist");

    const handlers = createPhase8AgiHandlers({ projectRoot: ROOT });
    assert.equal(typeof handlers.eos_goal_driven_factory_audit, "function");

    const mcpReceipt = handlers.eos_goal_driven_factory_audit({});
    assert.equal(mcpReceipt.specId, "SPEC-378");
    assert.equal(mcpReceipt.changeId, "CHANGE-240");
    assert.equal(mcpReceipt.status, "VERIFIED");
    assert.equal(mcpReceipt.invariants.vagueGoalRejected, true);
    assert.equal(mcpReceipt.invariants.verifierTamperBlocked, true);
    assert.equal(mcpReceipt.invariants.boundedLoopHaltsOnBudget, true);
    assert.equal(mcpReceipt.invariants.parallelFactoryDisjointEnforced, true);
    assert.equal(mcpReceipt.invariants.prePrGatesCriticalOnlyVerified, true);
    assert.match(mcpReceipt.receiptHash, /^[0-9a-f]{64}$/);

    const receiptPath = resolveEvidencePath("GOAL_DRIVEN_FACTORY_RECEIPT.json", ROOT);
    assert.ok(fs.existsSync(receiptPath), "GOAL_DRIVEN_FACTORY_RECEIPT.json must be written via resolveEvidencePath");
    const persisted = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(persisted.receiptHash, mcpReceipt.receiptHash);
    assert.equal(typeof EosGoalDrivenFactoryCore.audit, "function");
  });
});
