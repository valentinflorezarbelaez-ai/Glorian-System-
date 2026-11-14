/**
 * src/core/eosDeepSpaceOpticalNavEphemerisCore.types.ts
 * SPEC-259 / CHANGE-129: Deep Space Optical Navigation & XNAV Ephemeris Core Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type DeepSpaceNavRegime = "NOMINAL_DEEP_SPACE_LOCK" | "SOLAR_CONJUNCTION_CAUTION" | "EPHEMERIS_DRIFT_CRITICAL";

export interface DeepSpaceOpticalNavOptions {
  readonly missionId?: string;
  readonly heliocentricDistanceAu?: number;
  readonly spacecraftVelocityKmPerSec?: number;
  readonly sunEarthProbeAngleDeg?: number;
  readonly pulsarCount?: number;
  readonly pulsarTimingResidualNs?: number;
  readonly deltaDorResidualPrad?: number;
  readonly maxPositionUncertaintyKm?: number;
}

export interface DeepSpaceOpticalNavAssessment {
  readonly specId: "SPEC-259";
  readonly missionId: string;
  readonly heliocentricDistanceAu: number;
  readonly spacecraftVelocityKmPerSec: number;
  readonly sunEarthProbeAngleDeg: number;
  readonly pulsarCount: number;
  readonly oneWayLightTimeSec: number;
  readonly shapiroDelayMicroSec: number;
  readonly stellarAberrationMicroRad: number;
  readonly xnavPositionUncertaintyKm: number;
  readonly deltaDorPositionUncertaintyKm: number;
  readonly combinedPositionUncertaintyKm: number;
  readonly maxPositionUncertaintyKm: number;
  readonly regime: DeepSpaceNavRegime;
  readonly deepSpaceNavDigestSha256: string;
}
