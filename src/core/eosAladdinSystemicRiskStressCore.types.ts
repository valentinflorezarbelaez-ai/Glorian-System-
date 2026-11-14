/**
 * SPEC-249 / CHANGE-124 — Layer-0 Aladdin Systemic Risk & Correlated Contagion Stress Types.
 */

export interface AladdinStressOptions {
  readonly projectRoot?: string;
  readonly registryRelPath?: string;
  readonly trials?: number;
  readonly seed?: number;
  readonly shockProbability?: number;
  readonly contagionCoupling?: number;
  readonly portfolioCountOverride?: number;
}

export type AladdinRiskTier = "RESILIENT_AAA" | "GUARDED_AA" | "SYSTEMIC_CRITICAL";

export interface AladdinSystemicRiskReport {
  readonly portfolioSize: number;
  readonly trialsExecuted: number;
  readonly seed: number;
  readonly expectedAvailabilityPercent: number;
  readonly valueAtRisk95Percent: number;
  readonly valueAtRisk99Percent: number;
  readonly expectedShortfall99Percent: number;
  readonly contagionAmplificationFactor: number;
  readonly riskTier: AladdinRiskTier;
  readonly circuitBreakerDirectives: readonly string[];
  readonly aladdinDigestSha256: string;
}
