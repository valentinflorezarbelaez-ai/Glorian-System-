/**
 * Glorian System — Goal-Driven Development Loop, Immutable Verifier Guard,
 * Parallel Worktree Software Factory & 3-Gate Pre-PR Engine (Layer-0)
 *
 * Synthesizes LIDR Agentic Engineer Starter 2027 Module 7 (Goal-Driven Development):
 *   1. Output Goal Contract Validator & Outcome Separation (FR-378-01)
 *   2. Immutable Verifier Integrity & Anti-Cheating Guard (FR-378-02)
 *   3. Bounded Output-Driven Verification Loop Engine (FR-378-03)
 *   4. Parallel Worktree Software Factory Disjoint Planner (FR-378-04)
 *   5. Three-Gate Pre-PR Readiness Evaluator (FR-378-05)
 *   6. Non-Vacuous Invariant Audit & Hermetic SHA-256 Receipt (FR-378-06)
 *
 * Part of SPEC-378 / CHANGE-240
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, Node 24 strip-only.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";
import {
  DEFAULT_PROTECTED_VERIFIER_PATHS,
  VAGUE_METRIC_PATTERNS,
  compareGoalMetric,
  matchesGlobPattern,
  normalizePosixPath,
  roundTo,
  sha256Hex,
} from "./eosGoalDrivenFactoryCore.types.ts";
import type {
  FactoryConflict,
  FactoryExecutionWave,
  FactoryRunInput,
  FactoryRunPlanReport,
  FactoryTaskSpec,
  GoalContractInput,
  GoalContractValidationReport,
  GoalDrivenFactoryAuditReceipt,
  GoalLoopAttemptEntry,
  GoalLoopInput,
  GoalLoopReport,
  GoalLoopStopReason,
  GoalValidationViolation,
  PrePrGateInput,
  PrePrGateReport,
  VerifierIntegrityInput,
  VerifierIntegrityReport,
  VerifierTamperViolation,
} from "./eosGoalDrivenFactoryCore.types.ts";

export * from "./eosGoalDrivenFactoryCore.types.ts";

// ---------------------------------------------------------------------------
// 1. Output Goal Contract Validator & Outcome Separation (FR-378-01)
// ---------------------------------------------------------------------------

function checkGoalCoreFields(input: GoalContractInput, violations: GoalValidationViolation[]): void {
  if (!input.goalId || input.goalId.trim().length === 0) {
    violations.push({ code: "EMPTY_GOAL_ID", detail: "goalId must be a non-empty identifier" });
  }
  const combinedText = `${input.description || ""} ${input.metricName || ""}`;
  if (VAGUE_METRIC_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    violations.push({
      code: "VAGUE_GOAL_PROSE",
      detail: "Goal description or metric uses ambiguous prose (specify exact metric, operator, and threshold)",
    });
  }
  if (!input.metricName || input.metricName.trim().length === 0) {
    violations.push({ code: "MISSING_METRIC_NAME", detail: "metricName is required for output verification" });
  }
  if (!Number.isFinite(input.threshold)) {
    violations.push({ code: "NON_FINITE_THRESHOLD", detail: "threshold must be a finite numeric value" });
  }
  if (!input.unit || input.unit.trim().length === 0) {
    violations.push({ code: "MISSING_UNIT", detail: "unit is required alongside threshold" });
  }
  if (!input.verifyCommand || input.verifyCommand.trim().length === 0) {
    violations.push({ code: "MISSING_VERIFY_COMMAND", detail: "verifyCommand is required to test the output goal" });
  }
}

export function validateGoalContract(input: GoalContractInput): GoalContractValidationReport {
  const violations: GoalValidationViolation[] = [];
  checkGoalCoreFields(input, violations);

  if (!Number.isFinite(input.maxAttempts) || input.maxAttempts <= 0) {
    violations.push({ code: "UNBOUNDED_ATTEMPTS", detail: "maxAttempts must be a finite positive integer" });
  }
  if (!Number.isFinite(input.maxDurationMs) || input.maxDurationMs <= 0) {
    violations.push({ code: "UNBOUNDED_DURATION", detail: "maxDurationMs must be a finite positive limit" });
  }
  if (!Number.isFinite(input.maxCostUsd) || input.maxCostUsd <= 0) {
    violations.push({ code: "UNBOUNDED_COST", detail: "maxCostUsd must be a finite positive cost cap" });
  }

  if (input.kind === "OUTCOME") {
    if (!input.outcomeFollowUp || !input.outcomeFollowUp.metricsSource.trim()) {
      violations.push({
        code: "OUTCOME_REQUIRES_OUTPUT_ANCHOR",
        detail: "OUTCOME goals must declare an output verification contract plus post-launch metricsSource",
      });
    } else if (!Number.isFinite(input.outcomeFollowUp.reviewAfterDays) || input.outcomeFollowUp.reviewAfterDays < 15) {
      violations.push({
        code: "OUTCOME_PREMATURE_REVIEW",
        detail: "Business outcomes require real user telemetry (reviewAfterDays >= 15) and cannot close same-day",
      });
    }
  }

  const valid = violations.length === 0;
  return {
    goalId: input.goalId,
    kind: input.kind,
    valid,
    verdict: valid ? "VALID" : "REJECTED_VAGUE_GOAL",
    sameDayClosable: input.kind === "OUTPUT",
    violations,
    attestationHash: sha256Hex({ goalId: input.goalId, kind: input.kind, valid, violations }),
  };
}

// ---------------------------------------------------------------------------
// 2. Immutable Verifier Integrity & Anti-Cheating Guard (FR-378-02)
// ---------------------------------------------------------------------------

function matchesProtectedPattern(filePath: string, patterns: readonly string[]): boolean {
  const norm = normalizePosixPath(filePath);
  for (const rawPattern of patterns) {
    const pattern = normalizePosixPath(rawPattern);
    if (matchesGlobPattern(norm, pattern)) return true;
    if (pattern.startsWith("**/") && matchesGlobPattern(norm, pattern.slice(3))) return true;
  }
  return false;
}

function normalizeDigestMap(digests?: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!digests) return out;
  for (const [k, v] of Object.entries(digests)) {
    out[normalizePosixPath(k)] = v;
  }
  return out;
}

export function verifyVerifierIntegrity(input: VerifierIntegrityInput): VerifierIntegrityReport {
  const patterns = [...DEFAULT_PROTECTED_VERIFIER_PATHS, ...(input.protectedPaths ?? [])];
  const violations: VerifierTamperViolation[] = [];
  const uniqueFiles = Array.from(new Set(input.changedFiles.map(normalizePosixPath))).filter(Boolean);

  for (const filePath of uniqueFiles) {
    if (matchesProtectedPattern(filePath, patterns)) {
      violations.push({
        code: "PROTECTED_VERIFIER_MUTATION",
        target: filePath,
        detail: `Candidate implementation must not modify protected verifier artifact: ${filePath}`,
      });
    }
  }

  const before = normalizeDigestMap(input.beforeDigests);
  const after = normalizeDigestMap(input.afterDigests);
  for (const [filePath, expectedHash] of Object.entries(before)) {
    if (Object.prototype.hasOwnProperty.call(after, filePath) && after[filePath] !== expectedHash) {
      violations.push({
        code: "VERIFIER_DIGEST_DRIFT",
        target: filePath,
        detail: `Verifier SHA-256 changed during execution loop for ${filePath}`,
      });
    }
  }

  const verifierIntact = violations.length === 0;
  return {
    verifierIntact,
    verdict: verifierIntact ? "VERIFIER_INTACT" : "HARD_BLOCK_TAMPERED",
    checkedFiles: uniqueFiles.length,
    violations,
    attestationHash: sha256Hex({ verifierIntact, checkedFiles: uniqueFiles.length, violations }),
  };
}

// ---------------------------------------------------------------------------
// 3. Bounded Output-Driven Verification Loop Engine (FR-378-03)
// ---------------------------------------------------------------------------

function buildHaltedLoopReport(
  goal: GoalContractInput,
  status: GoalLoopReport["status"],
  stopReason: GoalLoopStopReason,
  deliveryClassification: GoalLoopReport["deliveryClassification"],
  totalDurationMs: number,
  totalCostUsd: number,
  totalTokensUsed: number,
  attemptLedger: readonly GoalLoopAttemptEntry[],
): GoalLoopReport {
  const payload = {
    goalId: goal.goalId,
    status,
    stopReason,
    attemptsExecuted: attemptLedger.length,
    totalDurationMs,
    totalCostUsd: roundTo(totalCostUsd, 6),
    totalTokensUsed,
  };
  return {
    ...payload,
    goalMet: status === "GOAL_MET",
    outcomeVerified: false,
    deliveryClassification,
    attemptLedger,
    attestationHash: sha256Hex(payload),
  };
}

export function runBoundedGoalLoop(input: GoalLoopInput): GoalLoopReport {
  const goalCheck = validateGoalContract(input.goal);
  if (!goalCheck.valid) {
    return buildHaltedLoopReport(
      input.goal,
      "HALTED_INVALID_GOAL",
      "INVALID_GOAL_CONTRACT",
      "NOT_VERIFIED",
      0,
      0,
      0,
      [],
    );
  }

  const ledger: GoalLoopAttemptEntry[] = [];
  let totalDurationMs = 0;
  let totalCostUsd = 0;
  let totalTokensUsed = 0;

  for (const attempt of input.attempts) {
    if (ledger.length >= input.goal.maxAttempts) {
      return buildHaltedLoopReport(
        input.goal,
        "HALTED_BUDGET_EXHAUSTED",
        "MAX_ATTEMPTS_EXCEEDED",
        "NOT_VERIFIED",
        totalDurationMs,
        totalCostUsd,
        totalTokensUsed,
        ledger,
      );
    }

    const verifierInput: VerifierIntegrityInput = attempt.verifierCheck ?? {
      changedFiles: attempt.changedFiles ?? [],
      protectedPaths: input.protectedPaths,
      beforeDigests: input.beforeDigests,
      afterDigests: input.afterDigests,
    };
    const verifier = verifyVerifierIntegrity(verifierInput);

    totalDurationMs += Math.max(0, attempt.durationMs);
    totalCostUsd += Math.max(0, attempt.costUsd);
    totalTokensUsed += Math.max(0, attempt.tokensUsed ?? 0);

    if (!verifier.verifierIntact) {
      ledger.push({
        attemptNumber: attempt.attemptNumber,
        observedValue: attempt.observedValue,
        commandExitCode: attempt.commandExitCode,
        verifierIntact: false,
        passed: false,
        cumulativeDurationMs: totalDurationMs,
        cumulativeCostUsd: roundTo(totalCostUsd, 6),
        summary: attempt.summary,
      });
      return buildHaltedLoopReport(
        input.goal,
        "HALTED_VERIFIER_TAMPERED",
        "VERIFIER_TAMPERED",
        "BLOCKED_TAMPERED_VERIFIER",
        totalDurationMs,
        totalCostUsd,
        totalTokensUsed,
        ledger,
      );
    }

    const budgetStop: GoalLoopStopReason | null =
      totalDurationMs > input.goal.maxDurationMs
        ? "MAX_DURATION_EXCEEDED"
        : totalCostUsd > input.goal.maxCostUsd
          ? "MAX_COST_EXCEEDED"
          : input.goal.maxTotalTokens !== undefined && totalTokensUsed > input.goal.maxTotalTokens
            ? "MAX_TOKENS_EXCEEDED"
            : null;

    const metricMet = compareGoalMetric(attempt.observedValue, input.goal.operator, input.goal.threshold);
    const passed = budgetStop === null && attempt.commandExitCode === 0 && metricMet;

    ledger.push({
      attemptNumber: attempt.attemptNumber,
      observedValue: attempt.observedValue,
      commandExitCode: attempt.commandExitCode,
      verifierIntact: true,
      passed,
      cumulativeDurationMs: totalDurationMs,
      cumulativeCostUsd: roundTo(totalCostUsd, 6),
      summary: attempt.summary,
    });

    if (budgetStop !== null) {
      return buildHaltedLoopReport(
        input.goal,
        "HALTED_BUDGET_EXHAUSTED",
        budgetStop,
        "NOT_VERIFIED",
        totalDurationMs,
        totalCostUsd,
        totalTokensUsed,
        ledger,
      );
    }
    if (passed) {
      return buildHaltedLoopReport(
        input.goal,
        "GOAL_MET",
        "GOAL_SATISFIED",
        "OUTPUT_VERIFIED",
        totalDurationMs,
        totalCostUsd,
        totalTokensUsed,
        ledger,
      );
    }
  }

  const finalReason: GoalLoopStopReason =
    ledger.length >= input.goal.maxAttempts ? "MAX_ATTEMPTS_EXCEEDED" : "NO_PASSING_ATTEMPT";
  return buildHaltedLoopReport(
    input.goal,
    "HALTED_BUDGET_EXHAUSTED",
    finalReason,
    "NOT_VERIFIED",
    totalDurationMs,
    totalCostUsd,
    totalTokensUsed,
    ledger,
  );
}

// ---------------------------------------------------------------------------
// 4. Parallel Software Factory Disjoint Worktree & Budget Planner (FR-378-04)
// ---------------------------------------------------------------------------

function detectFactoryCollisions(tasks: readonly FactoryTaskSpec[]): FactoryConflict[] {
  const conflicts: FactoryConflict[] = [];
  const seenWorktrees = new Map<string, string>();
  const seenBranches = new Map<string, string>();
  const seenEditPaths = new Map<string, string>();

  for (const task of tasks) {
    const goalCheck = validateGoalContract(task.goal);
    if (!goalCheck.valid) {
      conflicts.push({
        code: "INVALID_TASK_GOAL",
        taskIds: [task.taskId],
        target: task.goal.goalId,
        detail: goalCheck.violations.map((v) => v.code).join(", "),
      });
    }

    const wtKey = normalizePosixPath(task.worktreePath).toLowerCase();
    const prevWt = seenWorktrees.get(wtKey);
    if (prevWt) {
      conflicts.push({
        code: "WORKTREE_COLLISION",
        taskIds: [prevWt, task.taskId],
        target: task.worktreePath,
        detail: `Parallel factory tasks must not share git worktree path: ${task.worktreePath}`,
      });
    } else {
      seenWorktrees.set(wtKey, task.taskId);
    }

    const brKey = task.branchName.trim();
    const prevBr = seenBranches.get(brKey);
    if (prevBr) {
      conflicts.push({
        code: "BRANCH_COLLISION",
        taskIds: [prevBr, task.taskId],
        target: task.branchName,
        detail: `Parallel factory tasks must use distinct branch names: ${task.branchName}`,
      });
    } else {
      seenBranches.set(brKey, task.taskId);
    }

    for (const rawEditPath of task.editSurfacePaths) {
      const editKey = normalizePosixPath(rawEditPath);
      const prevOwner = seenEditPaths.get(editKey);
      if (prevOwner && prevOwner !== task.taskId) {
        conflicts.push({
          code: "EDIT_SURFACE_OVERLAP",
          taskIds: [prevOwner, task.taskId],
          target: editKey,
          detail: `Disjoint edit surface violated on ${editKey}`,
        });
      } else {
        seenEditPaths.set(editKey, task.taskId);
      }
    }
  }
  return conflicts;
}

export function planSoftwareFactoryRun(input: FactoryRunInput): FactoryRunPlanReport {
  const concurrency = Math.max(1, Math.floor(input.maxConcurrency || 1));
  const conflicts = detectFactoryCollisions(input.tasks);
  const totalReservedCostUsd = roundTo(
    input.tasks.reduce((sum, task) => sum + Math.max(0, task.goal.maxCostUsd || 0), 0),
    6,
  );

  if (conflicts.length > 0) {
    return {
      batchId: input.batchId,
      verdict: "CONFLICT_BLOCKED",
      taskCount: input.tasks.length,
      totalReservedCostUsd,
      conflicts,
      waves: [],
      attestationHash: sha256Hex({ batchId: input.batchId, verdict: "CONFLICT_BLOCKED", conflicts }),
    };
  }

  if (totalReservedCostUsd > input.totalMaxCostUsd) {
    return {
      batchId: input.batchId,
      verdict: "FACTORY_BUDGET_EXCEEDED",
      taskCount: input.tasks.length,
      totalReservedCostUsd,
      conflicts: [],
      waves: [],
      attestationHash: sha256Hex({
        batchId: input.batchId,
        verdict: "FACTORY_BUDGET_EXCEEDED",
        totalReservedCostUsd,
        totalMaxCostUsd: input.totalMaxCostUsd,
      }),
    };
  }

  const waves: FactoryExecutionWave[] = [];
  for (let i = 0; i < input.tasks.length; i += concurrency) {
    waves.push({
      waveNumber: waves.length + 1,
      tasks: input.tasks.slice(i, i + concurrency).map((t) => ({
        taskId: t.taskId,
        worktreePath: normalizePosixPath(t.worktreePath),
        branchName: t.branchName,
        maxCostUsd: t.goal.maxCostUsd,
      })),
    });
  }

  return {
    batchId: input.batchId,
    verdict: "READY_FOR_FACTORY",
    taskCount: input.tasks.length,
    totalReservedCostUsd,
    conflicts: [],
    waves,
    attestationHash: sha256Hex({ batchId: input.batchId, verdict: "READY_FOR_FACTORY", waves }),
  };
}

// ---------------------------------------------------------------------------
// 5. Three-Gate Pre-PR Readiness Evaluator (FR-378-05)
// ---------------------------------------------------------------------------

export function evaluatePrePrGates(input: PrePrGateInput): PrePrGateReport {
  const blockingReasons: string[] = [];
  const criticalFindings = input.findings.filter((f) => f.severity === "critical");
  const nonBlockingFindings = input.findings.filter((f) => f.severity !== "critical");

  const mandatoryTests = Boolean(input.testsExecuted && input.unitTestsPassed && input.e2eTestsPassed);
  if (!mandatoryTests) {
    blockingReasons.push("Gate 1 failed: unit and E2E tests must both be executed and passing");
  }

  const distinctAgents =
    input.implementerAgentId.trim().length > 0 &&
    input.reviewerAgentId.trim().length > 0 &&
    input.reviewerAgentId.trim() !== input.implementerAgentId.trim();
  const independentAdversarialReview = distinctAgents && criticalFindings.length === 0;
  if (!distinctAgents) {
    blockingReasons.push("Gate 2 failed: adversarial reviewer must be distinct from implementer agent");
  }
  if (criticalFindings.length > 0) {
    blockingReasons.push(`Gate 2 failed: ${criticalFindings.length} critical finding(s) must be resolved`);
  }

  const verifyCompleteness = Boolean(
    input.verifyCommandExecuted && input.verifierIntact && input.incompleteTasks === 0,
  );
  if (!input.verifyCommandExecuted) blockingReasons.push("Gate 3 failed: /verify command has not executed");
  if (!input.verifierIntact) blockingReasons.push("Gate 3 failed: verifier integrity compromised");
  if (input.incompleteTasks > 0) {
    blockingReasons.push(`Gate 3 failed: ${input.incompleteTasks} incomplete task(s) remain`);
  }

  const readyForPr = mandatoryTests && independentAdversarialReview && verifyCompleteness;
  const verdict = readyForPr ? "READY_FOR_PR" : "BLOCKED";
  return {
    prId: input.prId,
    verdict,
    readyForPr,
    gates: {
      mandatoryTests,
      independentAdversarialReview,
      verifyCompleteness,
    },
    blockingReasons,
    nonBlockingFindings,
    attestationHash: sha256Hex({
      prId: input.prId,
      verdict,
      blockingReasons,
      nonBlockingCount: nonBlockingFindings.length,
    }),
  };
}

// ---------------------------------------------------------------------------
// 6. Facade & Non-Vacuous Invariant Audit (FR-378-06)
// ---------------------------------------------------------------------------

const AUDIT_BASE_GOAL: GoalContractInput = {
  goalId: "AUDIT-OUTPUT-LATENCY",
  kind: "OUTPUT",
  description: "List query responds under 200 ms with 10000 rows",
  metricName: "p95LatencyMs",
  operator: "<",
  threshold: 200,
  unit: "ms",
  verifyCommand: "node scripts/bench-list.mjs",
  maxAttempts: 3,
  maxDurationMs: 60_000,
  maxCostUsd: 1.5,
};

export class EosGoalDrivenFactoryCore {
  static validateGoalContract = validateGoalContract;
  static verifyVerifierIntegrity = verifyVerifierIntegrity;
  static runBoundedGoalLoop = runBoundedGoalLoop;
  static planSoftwareFactoryRun = planSoftwareFactoryRun;
  static evaluatePrePrGates = evaluatePrePrGates;

  static audit(projectRoot: string = process.cwd()): GoalDrivenFactoryAuditReceipt {
    const vagueRes = validateGoalContract({
      ...AUDIT_BASE_GOAL,
      goalId: "AUDIT-VAGUE",
      description: "improve list performance",
      metricName: "better speed",
      threshold: Number.NaN,
      verifyCommand: "",
      maxCostUsd: 0,
    });
    const prematureOutcome = validateGoalContract({
      ...AUDIT_BASE_GOAL,
      kind: "OUTCOME",
      outcomeFollowUp: { metricsSource: "stripe", reviewAfterDays: 3, decisionOwner: "product" },
    });
    const validOutput = validateGoalContract(AUDIT_BASE_GOAL);
    const vagueGoalRejected =
      !vagueRes.valid && !prematureOutcome.valid && !prematureOutcome.sameDayClosable && validOutput.valid;

    const tamperRes = verifyVerifierIntegrity({
      changedFiles: ["test/eosCore.test.mjs", ".github/workflows/eos-sovereign-cicd.yml"],
      beforeDigests: { "scripts/verify-strict.mjs": "aaa" },
      afterDigests: { "scripts/verify-strict.mjs": "bbb" },
    });
    const cleanDiff = verifyVerifierIntegrity({ changedFiles: ["src/core/billing.ts"] });
    const verifierTamperBlocked = !tamperRes.verifierIntact && cleanDiff.verifierIntact;

    const converging = runBoundedGoalLoop({
      goal: AUDIT_BASE_GOAL,
      attempts: [
        {
          attemptNumber: 1,
          durationMs: 1200,
          costUsd: 0.35,
          observedValue: 260,
          commandExitCode: 1,
          summary: "Add index",
        },
        {
          attemptNumber: 2,
          durationMs: 1100,
          costUsd: 0.35,
          observedValue: 142,
          commandExitCode: 0,
          summary: "Pass bench",
        },
      ],
    });
    const runaway = runBoundedGoalLoop({
      goal: AUDIT_BASE_GOAL,
      attempts: [
        {
          attemptNumber: 1,
          durationMs: 1000,
          costUsd: 0.9,
          observedValue: 250,
          commandExitCode: 1,
          summary: "Probe 1",
        },
        {
          attemptNumber: 2,
          durationMs: 1000,
          costUsd: 0.9,
          observedValue: 240,
          commandExitCode: 1,
          summary: "Probe 2",
        },
      ],
    });
    const boundedLoopHaltsOnBudget =
      converging.status === "GOAL_MET" && !converging.outcomeVerified && runaway.status === "HALTED_BUDGET_EXHAUSTED";

    const collidedFactory = planSoftwareFactoryRun({
      batchId: "AUDIT-COLLIDE",
      maxConcurrency: 2,
      totalMaxCostUsd: 5,
      tasks: [
        {
          taskId: "T-1",
          worktreePath: "/wt/1",
          branchName: "fix/t1",
          editSurfacePaths: ["src/a.ts"],
          goal: AUDIT_BASE_GOAL,
        },
        {
          taskId: "T-2",
          worktreePath: "/wt/1",
          branchName: "fix/t2",
          editSurfacePaths: ["src/b.ts"],
          goal: AUDIT_BASE_GOAL,
        },
      ],
    });
    const cleanFactory = planSoftwareFactoryRun({
      batchId: "AUDIT-CLEAN",
      maxConcurrency: 2,
      totalMaxCostUsd: 5,
      tasks: [
        {
          taskId: "T-1",
          worktreePath: "/wt/1",
          branchName: "fix/t1",
          editSurfacePaths: ["src/a.ts"],
          goal: AUDIT_BASE_GOAL,
        },
        {
          taskId: "T-2",
          worktreePath: "/wt/2",
          branchName: "fix/t2",
          editSurfacePaths: ["src/b.ts"],
          goal: AUDIT_BASE_GOAL,
        },
        {
          taskId: "T-3",
          worktreePath: "/wt/3",
          branchName: "fix/t3",
          editSurfacePaths: ["src/c.ts"],
          goal: AUDIT_BASE_GOAL,
        },
      ],
    });
    const parallelFactoryDisjointEnforced =
      collidedFactory.verdict === "CONFLICT_BLOCKED" &&
      cleanFactory.verdict === "READY_FOR_FACTORY" &&
      cleanFactory.waves.length === 2;

    const passWithWarns = evaluatePrePrGates({
      prId: "PR-AUDIT-1",
      testsExecuted: true,
      unitTestsPassed: true,
      e2eTestsPassed: true,
      implementerAgentId: "worker-impl",
      reviewerAgentId: "worker-reviewer",
      findings: [
        { id: "W-1", severity: "warning", summary: "Consider extracting helper" },
        { id: "S-1", severity: "suggestion", summary: "Rename local constant" },
      ],
      verifyCommandExecuted: true,
      verifierIntact: true,
      incompleteTasks: 0,
    });
    const blockOnCritical = evaluatePrePrGates({
      prId: "PR-AUDIT-2",
      testsExecuted: true,
      unitTestsPassed: true,
      e2eTestsPassed: true,
      implementerAgentId: "worker-impl",
      reviewerAgentId: "worker-reviewer",
      findings: [{ id: "C-1", severity: "critical", summary: "SQL injection risk" }],
      verifyCommandExecuted: true,
      verifierIntact: true,
      incompleteTasks: 0,
    });
    const prePrGatesCriticalOnlyVerified =
      passWithWarns.readyForPr && passWithWarns.nonBlockingFindings.length === 2 && !blockOnCritical.readyForPr;

    const invariants = {
      vagueGoalRejected,
      verifierTamperBlocked,
      boundedLoopHaltsOnBudget,
      parallelFactoryDisjointEnforced,
      prePrGatesCriticalOnlyVerified,
    };
    const allPassed = Object.values(invariants).every(Boolean);
    const sampleMetrics = {
      convergingAttemptsUsed: converging.attemptsExecuted,
      factoryWavesPlanned: cleanFactory.waves.length,
      nonBlockingWarningsPreserved: passWithWarns.nonBlockingFindings.length,
    };
    const receiptHash = sha256Hex({ specId: "SPEC-378", invariants, sampleMetrics });
    const receipt: GoalDrivenFactoryAuditReceipt = {
      specId: "SPEC-378",
      changeId: "CHANGE-240",
      status: allPassed ? "VERIFIED" : "FAILED",
      generatedAt: new Date().toISOString(),
      invariants,
      sampleMetrics,
      receiptHash,
    };
    const receiptPath = resolveEvidencePath("GOAL_DRIVEN_FACTORY_RECEIPT.json", projectRoot);
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    return receipt;
  }
}
