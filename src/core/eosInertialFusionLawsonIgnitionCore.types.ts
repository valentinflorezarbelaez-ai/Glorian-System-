/**
 * SPEC-105 / CHANGE-127 — Inertial Fusion Lawson Ignition & Energy Balance Types.
 */

export type FusionIgnitionVerdict =
  "IGNITION_SELF_SUSTAINING" | "BURNING_PLASMA_SUB_IGNITION" | "QUENCHED_BELOW_BREAKEVEN";

export interface LawsonFusionOptions {
  readonly electronDensityM3?: number;
  readonly confinementTimeSec?: number;
  readonly ionTemperatureKeV?: number;
  readonly plasmaVolumeM3?: number;
  readonly externalHeatingMw?: number;
  readonly implosionAsymmetryP2OverP0?: number;
  readonly zEffective?: number;
}

export interface LawsonFusionReport {
  readonly specId: "SPEC-105";
  readonly electronDensityM3: number;
  readonly confinementTimeSec: number;
  readonly ionTemperatureKeV: number;
  readonly plasmaVolumeM3: number;
  readonly tripleProductKeVSecPerM3: number;
  readonly dtReactivityM3PerSec: number;
  readonly fusionYieldMw: number;
  readonly alphaHeatingMw: number;
  readonly bremsstrahlungLossMw: number;
  readonly conductionLossMw: number;
  readonly totalLossMw: number;
  readonly externalHeatingMw: number;
  readonly netHeatingRateMw: number;
  readonly energyBalanceResidualRatio: number;
  readonly plasmaGainQ: number;
  readonly implosionAsymmetryP2OverP0: number;
  readonly verdict: FusionIgnitionVerdict;
  readonly fusionDigestSha256: string;
}
