/**
 * @fileoverview Type definitions for EosSweBenchEvalFlywheel.
 *
 * Implements SPEC-366 / CHANGE-228: SWE-Bench Autonomous Evaluation Harness & Fleet Eval Flywheel.
 * Strict Layer-0 types with zero external runtime dependencies.
 */

export type EvalTaskId = string;

export type EvalTaskStatus = "PENDING" | "STAGED" | "PATCHED" | "RESOLVED" | "FAILED" | "TIMEOUT";

export type FleetRepoId =
  | "aberamentho"
  | "atp-strength"
  | "biblioteca-gnostica-1"
  | "control-de-asistencia-abopack"
  | "crud-slack"
  | "donaciones"
  | "eos-system"
  | "performance-talent-group"
  | "portafolio";

export interface EvalChallenge {
  readonly taskId: EvalTaskId;
  readonly targetRepo: FleetRepoId;
  readonly problemStatement: string;
  readonly baseCommit: string;
  readonly failToPassTests: readonly string[];
  readonly passToPassTests: readonly string[];
  readonly patchMinimalityThresholdLines?: number;
}

export interface CandidatePatch {
  readonly patchId: string;
  readonly taskId: EvalTaskId;
  readonly diffContent: string;
  readonly generatedAt: number;
  readonly tokenCost: number;
}

export interface OracleGradingResult {
  readonly taskId: EvalTaskId;
  readonly status: EvalTaskStatus;
  readonly exitCode: number;
  readonly testResults: {
    readonly failToPassResolved: boolean;
    readonly passToPassPreserved: boolean;
  };
  readonly executionLatencyMs: number;
  readonly patchLinesChanged: number;
}

export interface SyntheticChallengeMiningSpec {
  readonly sourceRepo: FleetRepoId;
  readonly commitHash: string;
  readonly problemStatement: string;
  readonly testFile: string;
  readonly resolutionDiff: string;
}

export interface PassAtKScorecard {
  readonly totalTasks: number;
  readonly samplesPerTask: number;
  readonly passAt1: number;
  readonly passAt3: number;
  readonly passAt5: number;
  readonly meanTokenCost: number;
  readonly meanLatencyMs: number;
  readonly resolutionRatePercent: number;
}

export interface EosSweBenchEvalFlywheelReceipt {
  readonly receiptId: string;
  readonly specId: "SPEC-366";
  readonly changeId: "CHANGE-228";
  readonly timestamp: number;
  readonly scorecard: PassAtKScorecard;
  readonly fleetEvaluatedReposCount: number;
  readonly checks: {
    readonly hermeticSandboxing: "PASS" | "FAIL";
    readonly oracleGradingIntegrity: "PASS" | "FAIL";
    readonly syntheticChallengeMining: "PASS" | "FAIL";
    readonly passAtKStatisticalRigor: "PASS" | "FAIL";
    readonly circuitBreakerEnforcement: "PASS" | "FAIL";
    readonly zeroDependencyPurity: "PASS" | "FAIL";
  };
  readonly integrityHash: string;
}
