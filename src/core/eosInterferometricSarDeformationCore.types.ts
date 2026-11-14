/**
 * src/core/eosInterferometricSarDeformationCore.types.ts
 * SPEC-265 / CHANGE-130: Interferometric SAR Crustal Deformation & Coherence Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type InSarDeformationRegime =
  "PHASE_UNWRAPPED_COHERENT" | "TEMPORAL_DECORRELATION_WARNING" | "BASELINE_DECORRELATION_CRITICAL";

export interface InSarDeformationOptions {
  readonly passPairId?: string;
  readonly radarWavelengthMeters?: number;
  readonly slantRangeKm?: number;
  readonly incidenceAngleDeg?: number;
  readonly rangeResolutionMeters?: number;
  readonly perpendicularBaselineMeters?: number;
  readonly temporalBaselineDays?: number;
  readonly decorrelationTimeConstantDays?: number;
  readonly thermalSnrDb?: number;
  readonly unwrappedPhaseRad?: number;
  readonly minCoherenceThreshold?: number;
}

export interface InSarDeformationAssessment {
  readonly specId: "SPEC-265";
  readonly passPairId: string;
  readonly radarWavelengthMeters: number;
  readonly slantRangeKm: number;
  readonly incidenceAngleDeg: number;
  readonly rangeResolutionMeters: number;
  readonly perpendicularBaselineMeters: number;
  readonly temporalBaselineDays: number;
  readonly decorrelationTimeConstantDays: number;
  readonly thermalSnrDb: number;
  readonly unwrappedPhaseRad: number;
  readonly minCoherenceThreshold: number;
  readonly criticalBaselineMeters: number;
  readonly geometricCoherence: number;
  readonly temporalCoherence: number;
  readonly thermalCoherence: number;
  readonly totalCoherence: number;
  readonly ambiguityHeightMeters: number;
  readonly losDisplacementMm: number;
  readonly displacementUncertaintyMm: number;
  readonly regime: InSarDeformationRegime;
  readonly insarDeformationDigestSha256: string;
}
