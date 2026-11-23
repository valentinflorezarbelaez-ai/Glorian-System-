/**
 * Glorian System — Goal-Driven Development Loop, Immutable Verifier Guard,
 * Parallel Worktree Software Factory & 3-Gate Pre-PR Engine — Domain Types (Layer-0)
 *
 * Part of SPEC-378 / CHANGE-240 (LIDR M7 Goal-Driven Development Synthesis)
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, Node 24 strip-only.
 */

import { matchesGlobPattern, normalizePosixPath, roundTo, sha256Hex } from "./eosHarnessTokenEconomicsCore.types.ts";

export { matchesGlobPattern, normalizePosixPath, roundTo, sha256Hex };

// ---------------------------------------------------------------------------
// 1. Output vs. Outcome Goal Contract Types (FR-378-01)
// ---------------------------------------------------------------------------

export type GoalComparator = "<" | "<=" | ">" | ">=" | "===" | "!==";
export type GoalKind = "OUTPUT" | "OUTCOME";

export interface OutcomeFollowUpConfig {
  readonly metricsSource: string;
  readonly reviewAfterDays: number;
  readonly decisionOwner: string;
}

export interface GoalContractInput {
  readonly goalId: string;
  readonly kind: GoalKind;
  readonly description: string;
  readonly metricName: string;
  readonly operator: GoalComparator;
  readonly threshold: number;
  readonly unit: string;
  readonly verifyCommand: string;
  readonly maxAttempts: number;
  readonly maxDurationMs: number;
  readonly maxCostUsd: number;
  readonly maxTotalTokens?: number;
  readonly outcomeFollowUp?: OutcomeFollowUpConfig;
}

export type GoalViolationCode =
  | "EMPTY_GOAL_ID"
  | "VAGUE_GOAL_PROSE"
  | "MISSING_METRIC_NAME"
  | "NON_FINITE_THRESHOLD"
  | "MISSING_UNIT"
  | "MISSING_VERIFY_COMMAND"
  | "UNBOUNDED_ATTEMPTS"
  | "UNBOUNDED_DURATION"
  | "UNBOUNDED_COST"
  | "OUTCOME_REQUIRES_OUTPUT_ANCHOR"
  | "OUTCOME_PREMATURE_REVIEW";

export interface GoalValidationViolation {
  readonly code: GoalViolationCode;
  readonly detail: string;
}

export interface GoalContractValidationReport {
  readonly goalId: string;
  readonly kind: GoalKind;
  readonly valid: boolean;
  readonly verdict: "VALID" | "REJECTED_VAGUE_GOAL";
  readonly sameDayClosable: boolean;
  readonly violations: readonly GoalValidationViolation[];
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 2. Immutable Verifier Integrity & Anti-Cheating Guard Types (FR-378-02)
// ---------------------------------------------------------------------------

export const DEFAULT_PROTECTED_VERIFIER_PATHS: readonly string[] = Object.freeze([
  "test/**",
  "tests/**",
  "**/*.test.*",
  "**/*.spec.*",
  ".github/workflows/**",
  "scripts/verify-*.mjs",
  "scripts/run-tlc.mjs",
  "docs/specs/**",
  "openspec/specs/**",
  "vitest.config.*",
  "jest.config.*",
  "playwright.config.*",
]);

export const VAGUE_METRIC_PATTERNS: readonly RegExp[] = Object.freeze([
  /\bimprove\b/i,
  /\bbetter\b/i,
  /\bfaster\b/i,
  /\bcleaner\b/i,
  /\boptimize\b/i,
  /\bgood\b/i,
  /\bnice\b/i,
  /\bclean\s+up\b/i,
]);

export interface VerifierIntegrityInput {
  readonly changedFiles: readonly string[];
  readonly protectedPaths?: readonly string[];
  readonly beforeDigests?: Readonly<Record<string, string>>;
  readonly afterDigests?: Readonly<Record<string, string>>;
}

export interface VerifierTamperViolation {
  readonly code: "PROTECTED_VERIFIER_MUTATION" | "VERIFIER_DIGEST_DRIFT";
  readonly target: string;
  readonly detail: string;
}

export interface VerifierIntegrityReport {
  readonly verifierIntact: boolean;
  readonly verdict: "VERIFIER_INTACT" | "HARD_BLOCK_TAMPERED";
  readonly checkedFiles: number;
  readonly violations: readonly VerifierTamperViolation[];
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 3. Bounded Output-Driven Verification Loop Types (FR-378-03)
// ---------------------------------------------------------------------------

export interface GoalAttemptRecord {
  readonly attemptNumber: number;
  readonly durationMs: number;
  readonly costUsd: number;
  readonly tokensUsed?: number;
  readonly observedValue: number;
  readonly commandExitCode: number;
  readonly summary: string;
  readonly changedFiles?: readonly string[];
  readonly verifierCheck?: VerifierIntegrityInput;
}

export interface GoalLoopInput {
  readonly goal: GoalContractInput;
  readonly attempts: readonly GoalAttemptRecord[];
  readonly protectedPaths?: readonly string[];
  readonly beforeDigests?: Readonly<Record<string, string>>;
  readonly afterDigests?: Readonly<Record<string, string>>;
}

export interface GoalLoopAttemptEntry {
  readonly attemptNumber: number;
  readonly observedValue: number;
  readonly commandExitCode: number;
  readonly verifierIntact: boolean;
  readonly passed: boolean;
  readonly cumulativeDurationMs: number;
  readonly cumulativeCostUsd: number;
  readonly summary: string;
}

export type GoalLoopStopReason =
  | "GOAL_SATISFIED"
  | "INVALID_GOAL_CONTRACT"
  | "VERIFIER_TAMPERED"
  | "MAX_ATTEMPTS_EXCEEDED"
  | "MAX_DURATION_EXCEEDED"
  | "MAX_COST_EXCEEDED"
  | "MAX_TOKENS_EXCEEDED"
  | "NO_PASSING_ATTEMPT";

export interface GoalLoopReport {
  readonly goalId: string;
  readonly status: "GOAL_MET" | "HALTED_INVALID_GOAL" | "HALTED_VERIFIER_TAMPERED" | "HALTED_BUDGET_EXHAUSTED";
  readonly stopReason: GoalLoopStopReason;
  readonly goalMet: boolean;
  readonly outcomeVerified: boolean;
  readonly deliveryClassification: "OUTPUT_VERIFIED" | "NOT_VERIFIED" | "BLOCKED_TAMPERED_VERIFIER";
  readonly attemptsExecuted: number;
  readonly totalDurationMs: number;
  readonly totalCostUsd: number;
  readonly totalTokensUsed: number;
  readonly attemptLedger: readonly GoalLoopAttemptEntry[];
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 4. Parallel Worktree Software Factory Planner Types (FR-378-04)
// ---------------------------------------------------------------------------

export interface FactoryTaskSpec {
  readonly taskId: string;
  readonly worktreePath: string;
  readonly branchName: string;
  readonly editSurfacePaths: readonly string[];
  readonly goal: GoalContractInput;
}

export interface FactoryRunInput {
  readonly batchId: string;
  readonly maxConcurrency: number;
  readonly totalMaxCostUsd: number;
  readonly tasks: readonly FactoryTaskSpec[];
}

export interface FactoryConflict {
  readonly code: "WORKTREE_COLLISION" | "BRANCH_COLLISION" | "EDIT_SURFACE_OVERLAP" | "INVALID_TASK_GOAL";
  readonly taskIds: readonly string[];
  readonly target: string;
  readonly detail: string;
}

export interface FactoryExecutionWave {
  readonly waveNumber: number;
  readonly tasks: readonly {
    readonly taskId: string;
    readonly worktreePath: string;
    readonly branchName: string;
    readonly maxCostUsd: number;
  }[];
}

export interface FactoryRunPlanReport {
  readonly batchId: string;
  readonly verdict: "READY_FOR_FACTORY" | "CONFLICT_BLOCKED" | "FACTORY_BUDGET_EXCEEDED";
  readonly taskCount: number;
  readonly totalReservedCostUsd: number;
  readonly conflicts: readonly FactoryConflict[];
  readonly waves: readonly FactoryExecutionWave[];
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 5. Three-Gate Pre-PR Evaluator Types (FR-378-05)
// ---------------------------------------------------------------------------

export type ReviewSeverity = "critical" | "warning" | "suggestion";

export interface PrePrReviewFinding {
  readonly id: string;
  readonly severity: ReviewSeverity;
  readonly summary: string;
  readonly filePath?: string;
}

export interface PrePrGateInput {
  readonly prId: string;
  readonly testsExecuted: boolean;
  readonly unitTestsPassed: boolean;
  readonly e2eTestsPassed: boolean;
  readonly implementerAgentId: string;
  readonly reviewerAgentId: string;
  readonly findings: readonly PrePrReviewFinding[];
  readonly verifyCommandExecuted: boolean;
  readonly verifierIntact: boolean;
  readonly incompleteTasks: number;
}

export interface PrePrGateReport {
  readonly prId: string;
  readonly verdict: "READY_FOR_PR" | "BLOCKED";
  readonly readyForPr: boolean;
  readonly gates: {
    readonly mandatoryTests: boolean;
    readonly independentAdversarialReview: boolean;
    readonly verifyCompleteness: boolean;
  };
  readonly blockingReasons: readonly string[];
  readonly nonBlockingFindings: readonly PrePrReviewFinding[];
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 6. Audit Receipt Types (FR-378-06)
// ---------------------------------------------------------------------------

export interface GoalDrivenFactoryAuditReceipt {
  readonly specId: "SPEC-378";
  readonly changeId: "CHANGE-240";
  readonly status: "VERIFIED" | "FAILED";
  readonly generatedAt: string;
  readonly invariants: {
    readonly vagueGoalRejected: boolean;
    readonly verifierTamperBlocked: boolean;
    readonly boundedLoopHaltsOnBudget: boolean;
    readonly parallelFactoryDisjointEnforced: boolean;
    readonly prePrGatesCriticalOnlyVerified: boolean;
  };
  readonly sampleMetrics: {
    readonly convergingAttemptsUsed: number;
    readonly factoryWavesPlanned: number;
    readonly nonBlockingWarningsPreserved: number;
  };
  readonly receiptHash: string;
}

// ---------------------------------------------------------------------------
// 7. Pure Comparator Utility
// ---------------------------------------------------------------------------

export function compareGoalMetric(observed: number, operator: GoalComparator, threshold: number): boolean {
  if (!Number.isFinite(observed) || !Number.isFinite(threshold)) return false;
  if (operator === "<") return observed < threshold;
  if (operator === "<=") return observed <= threshold;
  if (operator === ">") return observed > threshold;
  if (operator === ">=") return observed >= threshold;
  if (operator === "===") return observed === threshold;
  return observed !== threshold;
}
