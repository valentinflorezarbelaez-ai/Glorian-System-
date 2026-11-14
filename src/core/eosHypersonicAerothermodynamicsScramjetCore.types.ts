/**
 * src/core/eosHypersonicAerothermodynamicsScramjetCore.types.ts
 * SPEC-262 / CHANGE-129: Hypersonic Aerothermodynamics & Scramjet Isolator Core Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type HypersonicScramjetRegime =
  "SUPERSONIC_COMBUSTION_STABLE" | "AEROTHERMAL_FLUX_ELEVATED" | "ISOLATOR_UNSTART_CRITICAL";

export interface HypersonicScramjetOptions {
  readonly vehicleId?: string;
  readonly freestreamMach?: number;
  readonly freestreamDensityKgPerM3?: number;
  readonly freestreamStaticTempK?: number;
  readonly wedgeDeflectionAngleDeg?: number;
  readonly noseLeadingEdgeRadiusMeters?: number;
  readonly combustorHeatReleaseRatio?: number;
  readonly maxTpsHeatFluxMwPerM2?: number;
}

export interface HypersonicScramjetAssessment {
  readonly specId: "SPEC-262";
  readonly vehicleId: string;
  readonly freestreamMach: number;
  readonly freestreamVelocityMPerSec: number;
  readonly obliqueShockAngleDeg: number;
  readonly normalShockPressureRatio: number;
  readonly stagnationHeatFluxMwPerM2: number;
  readonly maxTpsHeatFluxMwPerM2: number;
  readonly isolatorUnstartMargin: number;
  readonly specificImpulseSec: number;
  readonly regime: HypersonicScramjetRegime;
  readonly hypersonicAeroDigestSha256: string;
}
