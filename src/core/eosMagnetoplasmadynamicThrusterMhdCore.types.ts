/**
 * src/core/eosMagnetoplasmadynamicThrusterMhdCore.types.ts
 * SPEC-266 / CHANGE-130: Magnetoplasmadynamic (MPD) Thruster & Lorentz MHD Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type MpdThrusterRegime =
  "LORENTZ_PLASMA_ACCELERATION_LOCKED" | "ANODE_FALL_EROSION_WARNING" | "ONSET_INSTABILITY_CRITICAL";

export interface MpdThrusterMhdOptions {
  readonly thrusterId?: string;
  readonly dischargeCurrentAmps?: number;
  readonly appliedMagneticFieldTesla?: number;
  readonly massFlowRateKgPerSec?: number;
  readonly anodeRadiusMeters?: number;
  readonly cathodeRadiusMeters?: number;
  readonly inputPowerKw?: number;
  readonly propellantAtomicMassAmu?: number;
}

export interface MpdThrusterMhdAssessment {
  readonly specId: "SPEC-266";
  readonly thrusterId: string;
  readonly dischargeCurrentAmps: number;
  readonly appliedMagneticFieldTesla: number;
  readonly massFlowRateKgPerSec: number;
  readonly anodeRadiusMeters: number;
  readonly cathodeRadiusMeters: number;
  readonly inputPowerKw: number;
  readonly propellantAtomicMassAmu: number;
  readonly selfFieldThrustNewtons: number;
  readonly appliedFieldThrustNewtons: number;
  readonly totalThrustNewtons: number;
  readonly exhaustVelocityMPerSec: number;
  readonly specificImpulseSec: number;
  readonly onsetCriticalCurrentAmps: number;
  readonly onsetStabilityRatio: number;
  readonly thrustEfficiency: number;
  readonly regime: MpdThrusterRegime;
  readonly mpdThrusterDigestSha256: string;
}
