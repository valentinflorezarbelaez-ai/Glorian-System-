/**
 * src/core/eosDifferentialPrivacyAbacGovernorCore.types.ts
 * SPEC-255 / CHANGE-128: Differential Privacy & Zero-Trust ABAC Policy Governor Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type DifferentialPrivacyAbacVerdict =
  "PRIVACY_AND_ABAC_AUTHORIZED" | "PRIVACY_BUDGET_EXHAUSTED" | "ABAC_ZERO_TRUST_DENIED";

export interface DifferentialPrivacyAbacOptions {
  readonly principalId?: string;
  readonly subjectClearance?: number;
  readonly requiredClearance?: number;
  readonly subjectCompartments?: readonly string[];
  readonly requiredCompartments?: readonly string[];
  readonly mfaVerified?: boolean;
  readonly deviceTrustScore?: number;
  readonly minDeviceTrustScore?: number;
  readonly epsilonTotalBudget?: number;
  readonly epsilonAlreadySpent?: number;
  readonly queryEpsilon?: number;
  readonly deltaBudget?: number;
  readonly l1Sensitivity?: number;
  readonly recordCount?: number;
  readonly kAnonymityThreshold?: number;
  readonly minEquivalenceClassSize?: number;
}

export interface DifferentialPrivacyAbacReport {
  readonly specId: "SPEC-255";
  readonly principalId: string;
  readonly clearanceSatisfied: boolean;
  readonly compartmentsSatisfied: boolean;
  readonly trustSatisfied: boolean;
  readonly kAnonymitySatisfied: boolean;
  readonly abacAuthorized: boolean;
  readonly privacyBudgetAuthorized: boolean;
  readonly epsilonTotalBudget: number;
  readonly epsilonAlreadySpent: number;
  readonly queryEpsilon: number;
  readonly projectedEpsilonSpent: number;
  readonly remainingEpsilonBudget: number;
  readonly deltaBudget: number;
  readonly laplaceScale: number;
  readonly gaussianSigma: number;
  readonly recordCount: number;
  readonly verdict: DifferentialPrivacyAbacVerdict;
  readonly privacyAbacDigestSha256: string;
}
