/**
 * src/core/eosDeepSpaceOpticalNavEphemerisCore.ts
 * SPEC-259 / CHANGE-129: Deep Space Optical Navigation & Pulsar XNAV Ephemeris Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFinitePositive,
  assertHalfOpenRightRange,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  DeepSpaceNavRegime,
  DeepSpaceOpticalNavAssessment,
  DeepSpaceOpticalNavOptions,
} from "./eosDeepSpaceOpticalNavEphemerisCore.types.ts";

const AU_KM = 149_597_870.7;
const SPEED_OF_LIGHT_KM_S = 299_792.458;
const SOLAR_SHAPIRO_COEFF_US = 9.85098;

export const DEFAULT_DEEP_SPACE_NAV_OPTIONS: Readonly<Required<DeepSpaceOpticalNavOptions>> = deepFreeze({
  missionId: "DEEP-SPACE-XNAV-EUROPA-01",
  heliocentricDistanceAu: 5.2,
  spacecraftVelocityKmPerSec: 38.6,
  sunEarthProbeAngleDeg: 24.5,
  pulsarCount: 6,
  pulsarTimingResidualNs: 180.0,
  deltaDorResidualPrad: 1.8,
  maxPositionUncertaintyKm: 2.5,
});

function resolveValidatedNavParams(options: DeepSpaceOpticalNavOptions) {
  return {
    missionId: pickNonEmptyString(options.missionId, DEFAULT_DEEP_SPACE_NAV_OPTIONS.missionId),
    heliocentricDistanceAu: assertFinitePositive(
      pickDefined(options.heliocentricDistanceAu, DEFAULT_DEEP_SPACE_NAV_OPTIONS.heliocentricDistanceAu),
      "heliocentricDistanceAu",
    ),
    spacecraftVelocityKmPerSec: assertFinitePositive(
      pickDefined(options.spacecraftVelocityKmPerSec, DEFAULT_DEEP_SPACE_NAV_OPTIONS.spacecraftVelocityKmPerSec),
      "spacecraftVelocityKmPerSec",
    ),
    sunEarthProbeAngleDeg: assertHalfOpenRightRange(
      pickDefined(options.sunEarthProbeAngleDeg, DEFAULT_DEEP_SPACE_NAV_OPTIONS.sunEarthProbeAngleDeg),
      0,
      180,
      "sunEarthProbeAngleDeg must be in (0, 180].",
    ),
    pulsarCount: assertIntMin(
      pickDefined(options.pulsarCount, DEFAULT_DEEP_SPACE_NAV_OPTIONS.pulsarCount),
      3,
      "pulsarCount",
    ),
    pulsarTimingResidualNs: assertFinitePositive(
      pickDefined(options.pulsarTimingResidualNs, DEFAULT_DEEP_SPACE_NAV_OPTIONS.pulsarTimingResidualNs),
      "pulsarTimingResidualNs",
    ),
    deltaDorResidualPrad: assertFinitePositive(
      pickDefined(options.deltaDorResidualPrad, DEFAULT_DEEP_SPACE_NAV_OPTIONS.deltaDorResidualPrad),
      "deltaDorResidualPrad",
    ),
    maxPositionUncertaintyKm: assertFinitePositive(
      pickDefined(options.maxPositionUncertaintyKm, DEFAULT_DEEP_SPACE_NAV_OPTIONS.maxPositionUncertaintyKm),
      "maxPositionUncertaintyKm",
    ),
  };
}

function classifyNavRegime(sigmaPosKm: number, maxSigmaKm: number, sepDeg: number): DeepSpaceNavRegime {
  if (sigmaPosKm > maxSigmaKm) return "EPHEMERIS_DRIFT_CRITICAL";
  if (sepDeg < 5.0 || sigmaPosKm > 0.8 * maxSigmaKm) return "SOLAR_CONJUNCTION_CAUTION";
  return "NOMINAL_DEEP_SPACE_LOCK";
}

export class EosDeepSpaceOpticalNavEphemerisCore {
  static evaluateDeepSpaceOpticalNavEphemeris(options: DeepSpaceOpticalNavOptions = {}): DeepSpaceOpticalNavAssessment {
    const p = resolveValidatedNavParams(options);
    const rangeKm = p.heliocentricDistanceAu * AU_KM;
    const oneWayLightTimeSec = round6(rangeKm / SPEED_OF_LIGHT_KM_S);

    const sepRad = (p.sunEarthProbeAngleDeg * Math.PI) / 180;
    const shapiroArg = Math.max(1.0, (4 * p.heliocentricDistanceAu) / Math.max(1e-9, 1 - Math.cos(sepRad)));
    const shapiroDelayMicroSec = round6(SOLAR_SHAPIRO_COEFF_US * Math.log(shapiroArg));
    const stellarAberrationMicroRad = round6((p.spacecraftVelocityKmPerSec / SPEED_OF_LIGHT_KM_S) * 1e6);

    const xnavPositionUncertaintyKm = round6(
      (SPEED_OF_LIGHT_KM_S * (p.pulsarTimingResidualNs * 1e-9) * 1.25) / Math.sqrt(p.pulsarCount - 2),
    );
    const deltaDorPositionUncertaintyKm = round6(rangeKm * (p.deltaDorResidualPrad * 1e-12));
    const combinedPositionUncertaintyKm = round6(Math.hypot(xnavPositionUncertaintyKm, deltaDorPositionUncertaintyKm));
    const regime = classifyNavRegime(
      combinedPositionUncertaintyKm,
      p.maxPositionUncertaintyKm,
      p.sunEarthProbeAngleDeg,
    );

    const payload = {
      specId: "SPEC-259" as const,
      missionId: p.missionId,
      heliocentricDistanceAu: p.heliocentricDistanceAu,
      spacecraftVelocityKmPerSec: p.spacecraftVelocityKmPerSec,
      sunEarthProbeAngleDeg: p.sunEarthProbeAngleDeg,
      pulsarCount: p.pulsarCount,
      oneWayLightTimeSec,
      shapiroDelayMicroSec,
      stellarAberrationMicroRad,
      xnavPositionUncertaintyKm,
      deltaDorPositionUncertaintyKm,
      combinedPositionUncertaintyKm,
      maxPositionUncertaintyKm: p.maxPositionUncertaintyKm,
      regime,
    };
    const deepSpaceNavDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, deepSpaceNavDigestSha256 });
  }

  evaluate(options: DeepSpaceOpticalNavOptions = {}): DeepSpaceOpticalNavAssessment {
    return EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris(options);
  }
}

export const evaluateDeepSpaceOpticalNavEphemeris =
  EosDeepSpaceOpticalNavEphemerisCore.evaluateDeepSpaceOpticalNavEphemeris;
