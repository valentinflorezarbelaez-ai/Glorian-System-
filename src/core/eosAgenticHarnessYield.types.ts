/**
 * Glorian System — Agentic Harness Engineering, First-Pass PR Yield &
 * Token Rework Telemetry Engine (SPEC-339 / CHANGE-201)
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies.
 */

export type HarnessErrorCode =
  "HARNESS_INVALID_PARAMETERS" | "HARNESS_SPEC_INCOMPLETE" | "HARNESS_MAX_RETRIES_EXCEEDED";

export type HarnessStageName = "TYPECHECK" | "LINT_FORMAT" | "UNIT_BDD" | "FORMAL_TLC" | "SECURITY_HYGIENE";

export interface SpecReadinessInput {
  taskId?: string;
  earsRequirements: number;
  bddScenarios: number;
  adrCount: number;
  hasFormalTlaModel: boolean;
  ambiguityScore: number;
}

export interface SpecReadinessReport {
  taskId: string;
  readinessScore: number;
  earsRequirements: number;
  bddScenarios: number;
  adrCount: number;
  hasFormalTlaModel: boolean;
  ambiguityScore: number;
  missingCriteria: string[];
  approved: boolean;
}

export interface HarnessStageAttempt {
  stage: HarnessStageName;
  attempt: number;
  passed: boolean;
  tokensConsumed: number;
  reworkTokens: number;
  durationMs: number;
}

export interface HarnessExecutionConfig {
  spec: SpecReadinessInput;
  maxRetries?: number;
  stageFailures?: Partial<Record<HarnessStageName, number>>;
  tokenCostPer1kUsd?: number;
  firstPassStageTokens?: Partial<Record<HarnessStageName, number>>;
  repairTokensPerRetry?: number;
}

export interface HarnessExecutionResult {
  taskId: string;
  specReport: SpecReadinessReport;
  stagesExecuted: HarnessStageName[];
  attempts: HarnessStageAttempt[];
  firstPassSuccess: boolean;
  totalRetries: number;
  firstPassTokens: number;
  reworkTokens: number;
  totalTokens: number;
  reworkAmplificationFactor: number;
  estimatedCostUsd: number;
  prReady: boolean;
}

export interface PrTelemetryRecord {
  prId: string;
  methodology: "SDD_HARNESS" | "VIBE_CODING";
  firstPassSuccess: boolean;
  retries: number;
  firstPassTokens: number;
  reworkTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface CohortTelemetrySummary {
  cohortSize: number;
  firstPassCount: number;
  firstPassYieldRatio: number;
  meanReworkAmplificationFactor: number;
  totalTokens: number;
  firstPassTokens: number;
  wastedReworkTokens: number;
  totalCostUsd: number;
  meanCostPerMergedPrUsd: number;
}

export interface CohortBenchmarkReport {
  sddCohort: CohortTelemetrySummary;
  vibeCohort: CohortTelemetrySummary;
  yieldUpliftRatio: number;
  rafReductionRatio: number;
  tokenSavingsRatio: number;
  costSavingsUsd: number;
}

export interface AgenticHarnessAuditReceipt {
  specRef: "SPEC-339";
  specGateEnforced: boolean;
  harnessLoopConverged: boolean;
  retryCeilingEnforced: boolean;
  firstPassYieldComputed: boolean;
  sddOutperformsVibe: boolean;
  sddFirstPassYieldRatio: number;
  vibeFirstPassYieldRatio: number;
  tokenSavingsRatio: number;
  allPassed: boolean;
  sha256Digest: string;
}
