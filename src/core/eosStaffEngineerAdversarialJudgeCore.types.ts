/**
 * SPEC-237 / CHANGE-120 — Layer-0 Staff Engineer Adversarial Dual-Judge Types.
 * Zero external runtime dependencies (EOS Law V).
 */

export type AdversarialVerdictStatus = "APPROVED" | "CHANGES_REQUIRED" | "BLOCKED";

export interface StaffPillarScores {
  readonly idempotencyAndRetries: number;
  readonly resilienceAndBackpressure: number;
  readonly dataAndMigrationSafety: number;
  readonly observabilityAndSlo: number;
  readonly securityAndPrivacy: number;
  readonly testingHoneycombAndBeyonceRule: number;
}

export interface StaffJudgeInput {
  readonly targetId: string;
  readonly title?: string;
  readonly pillarScores?: Partial<StaffPillarScores>;
  readonly plainSecretsDetected?: boolean;
  readonly unsafeMigrationDetected?: boolean;
  readonly missingTestsForProdChanges?: boolean;
  readonly singlePointOfFailureDetected?: boolean;
}

export interface JudgePersonaEvaluation {
  readonly judgeId: "JudgeAlpha_ArchitectureAndResilience" | "JudgeBeta_SecurityAndOperability";
  readonly score: number;
  readonly passed: boolean;
  readonly findings: readonly string[];
}

export interface StaffAdversarialVerdictReport {
  readonly targetId: string;
  readonly title: string;
  readonly verdict: AdversarialVerdictStatus;
  readonly overallScore: number;
  readonly judgeAlpha: JudgePersonaEvaluation;
  readonly judgeBeta: JudgePersonaEvaluation;
  readonly pillarScores: StaffPillarScores;
  readonly blockingFindings: readonly string[];
  readonly requiredRemediations: readonly string[];
  readonly attestationDigestSha256: string;
}
