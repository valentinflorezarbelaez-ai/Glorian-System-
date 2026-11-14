/**
 * src/core/eosRelativisticBeamTwissLuminosityCore.types.ts
 * SPEC-258 / CHANGE-128: Relativistic Symplectic FODO Twiss Lattice & Luminosity Core Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type BeamOpticsVerdict =
  "BEAM_OPTICS_LUMINOSITY_LOCKED" | "SYNCHROTRON_LOSS_ELEVATED" | "LATTICE_RESONANCE_UNSTABLE";

export interface RelativisticBeamTwissOptions {
  readonly colliderId?: string;
  readonly beamEnergyGev?: number;
  readonly restMassGev?: number;
  readonly fodoHalfCellLengthM?: number;
  readonly fodoFocalLengthM?: number;
  readonly normalizedEmittanceUm?: number;
  readonly betaStarM?: number;
  readonly bunchesPerBeam?: number;
  readonly protonsPerBunch?: number;
  readonly revolutionFrequencyHz?: number;
  readonly crossingAngleReductionFactor?: number;
  readonly bendingRadiusM?: number;
  readonly maxSynchrotronLossKev?: number;
}

export interface RelativisticBeamTwissReport {
  readonly specId: "SPEC-258";
  readonly colliderId: string;
  readonly beamEnergyGev: number;
  readonly lorentzGamma: number;
  readonly relativisticBeta: number;
  readonly fodoMatrixTrace: number;
  readonly symplecticDeterminant: number;
  readonly fodoStable: boolean;
  readonly phaseAdvanceDeg: number;
  readonly betaMaxM: number;
  readonly betaMinM: number;
  readonly geometricEmittanceM: number;
  readonly ipBeamSigmaUm: number;
  readonly luminosityCm2s: number;
  readonly synchrotronLossKevPerTurn: number;
  readonly verdict: BeamOpticsVerdict;
  readonly beamOpticsDigestSha256: string;
}
