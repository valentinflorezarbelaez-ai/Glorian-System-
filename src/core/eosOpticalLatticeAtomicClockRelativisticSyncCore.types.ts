/**
 * src/core/eosOpticalLatticeAtomicClockRelativisticSyncCore.types.ts
 * SPEC-264 / CHANGE-130: Optical Lattice Atomic Clock & Relativistic Geodesy Sync Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type OpticalClockRegime = "FEMTOSECOND_TAI_LOCKED" | "BBR_OR_GEOPOTENTIAL_DRIFT_WARN" | "ALLAN_STABILITY_BREACH";

export interface OpticalLatticeClockOptions {
  readonly clockEnsembleId?: string;
  readonly clockTransitionFreqThz?: number;
  readonly naturalLinewidthMhz?: number;
  readonly interrogationAtomCount?: number;
  readonly averagingTimeSec?: number;
  readonly ambientTempK?: number;
  readonly geopotentialHeightDiffMeters?: number;
  readonly fiberLinkPhaseNoiseFs?: number;
  readonly maxFractionalInstabilityE18?: number;
}

export interface OpticalLatticeClockAssessment {
  readonly specId: "SPEC-264";
  readonly clockEnsembleId: string;
  readonly clockTransitionFreqThz: number;
  readonly naturalLinewidthMhz: number;
  readonly interrogationAtomCount: number;
  readonly averagingTimeSec: number;
  readonly ambientTempK: number;
  readonly geopotentialHeightDiffMeters: number;
  readonly fiberLinkPhaseNoiseFs: number;
  readonly maxFractionalInstabilityE18: number;
  readonly lineQualityFactorQ: number;
  readonly quantumProjectionSnr: number;
  readonly allanDeviationE18: number;
  readonly bbrResidualE18: number;
  readonly gravitationalRedshiftE18: number;
  readonly geopotentialUncertaintyE18: number;
  readonly combinedInstabilityE18: number;
  readonly timingSyncUncertaintyFs: number;
  readonly regime: OpticalClockRegime;
  readonly opticalClockDigestSha256: string;
}
