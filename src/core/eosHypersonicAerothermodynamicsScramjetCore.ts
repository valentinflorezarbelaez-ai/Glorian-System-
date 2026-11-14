/**
 * src/core/eosHypersonicAerothermodynamicsScramjetCore.ts
 * SPEC-262 / CHANGE-129: Hypersonic Oblique Shock, Fay-Riddell Heating & Scramjet Unstart Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFiniteMin,
  assertFinitePositive,
  assertHalfOpenRightRange,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  HypersonicScramjetAssessment,
  HypersonicScramjetOptions,
  HypersonicScramjetRegime,
} from "./eosHypersonicAerothermodynamicsScramjetCore.types.ts";

const GAMMA_AIR = 1.4;
const SPECIFIC_GAS_AIR = 287.05;

export const DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS: Readonly<Required<HypersonicScramjetOptions>> = deepFreeze({
  vehicleId: "SCRAMJET-WAVERIDER-MACH8-01",
  freestreamMach: 7.8,
  freestreamDensityKgPerM3: 0.0184,
  freestreamStaticTempK: 226.5,
  wedgeDeflectionAngleDeg: 10.5,
  noseLeadingEdgeRadiusMeters: 0.025,
  combustorHeatReleaseRatio: 0.42,
  maxTpsHeatFluxMwPerM2: 4.8,
});

function resolveValidatedAeroParams(options: HypersonicScramjetOptions) {
  return {
    vehicleId: pickNonEmptyString(options.vehicleId, DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS.vehicleId),
    freestreamMach: assertFiniteMin(
      pickDefined(options.freestreamMach, DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS.freestreamMach),
      3.0,
      "freestreamMach must be >= 3.0.",
    ),
    freestreamDensityKgPerM3: assertFinitePositive(
      pickDefined(options.freestreamDensityKgPerM3, DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS.freestreamDensityKgPerM3),
      "freestreamDensityKgPerM3",
    ),
    freestreamStaticTempK: assertFinitePositive(
      pickDefined(options.freestreamStaticTempK, DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS.freestreamStaticTempK),
      "freestreamStaticTempK",
    ),
    wedgeDeflectionAngleDeg: assertHalfOpenRightRange(
      pickDefined(options.wedgeDeflectionAngleDeg, DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS.wedgeDeflectionAngleDeg),
      0,
      40,
      "wedgeDeflectionAngleDeg must be in (0, 40] degrees.",
    ),
    noseLeadingEdgeRadiusMeters: assertFinitePositive(
      pickDefined(options.noseLeadingEdgeRadiusMeters, DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS.noseLeadingEdgeRadiusMeters),
      "noseLeadingEdgeRadiusMeters",
    ),
    combustorHeatReleaseRatio: assertHalfOpenRightRange(
      pickDefined(options.combustorHeatReleaseRatio, DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS.combustorHeatReleaseRatio),
      0,
      1.5,
      "combustorHeatReleaseRatio must be in (0, 1.5].",
    ),
    maxTpsHeatFluxMwPerM2: assertFinitePositive(
      pickDefined(options.maxTpsHeatFluxMwPerM2, DEFAULT_HYPERSONIC_SCRAMJET_OPTIONS.maxTpsHeatFluxMwPerM2),
      "maxTpsHeatFluxMwPerM2",
    ),
  };
}

function classifyScramjetRegime(unstartMargin: number, heatFlux: number, maxFlux: number): HypersonicScramjetRegime {
  if (unstartMargin <= 0.08 || heatFlux > maxFlux) return "ISOLATOR_UNSTART_CRITICAL";
  if (unstartMargin <= 0.22 || heatFlux > 0.8 * maxFlux) return "AEROTHERMAL_FLUX_ELEVATED";
  return "SUPERSONIC_COMBUSTION_STABLE";
}

export class EosHypersonicAerothermodynamicsScramjetCore {
  static evaluateHypersonicAerothermodynamicsScramjet(
    options: HypersonicScramjetOptions = {},
  ): HypersonicScramjetAssessment {
    const p = resolveValidatedAeroParams(options);
    const speedOfSound = Math.sqrt(GAMMA_AIR * SPECIFIC_GAS_AIR * p.freestreamStaticTempK);
    const freestreamVelocityMPerSec = round6(p.freestreamMach * speedOfSound);

    const thetaRad = (p.wedgeDeflectionAngleDeg * Math.PI) / 180;
    const hypTerm = ((GAMMA_AIR + 1) / 4) * thetaRad;
    const sinBeta = Math.min(0.98, hypTerm + Math.sqrt(1 / (p.freestreamMach * p.freestreamMach) + hypTerm * hypTerm));
    const obliqueShockAngleDeg = round6((Math.asin(sinBeta) * 180) / Math.PI);
    const mn1 = p.freestreamMach * sinBeta;
    const normalShockPressureRatio = round6(1 + ((2 * GAMMA_AIR) / (GAMMA_AIR + 1)) * (mn1 * mn1 - 1));

    const stagnationHeatFluxMwPerM2 = round6(
      (1.7415e-4 *
        Math.sqrt(p.freestreamDensityKgPerM3 / p.noseLeadingEdgeRadiusMeters) *
        Math.pow(freestreamVelocityMPerSec, 3)) /
        1e6,
    );

    const inletMach = Math.max(1.8, 0.52 * p.freestreamMach);
    const isolatorUnstartMargin = round6(1 - p.combustorHeatReleaseRatio / (0.72 * (1 - 1 / (inletMach * inletMach))));
    const specificImpulseSec = round6(Math.max(400, 1650 - 95 * (p.freestreamMach - 5)));
    const regime = classifyScramjetRegime(isolatorUnstartMargin, stagnationHeatFluxMwPerM2, p.maxTpsHeatFluxMwPerM2);

    const payload = {
      specId: "SPEC-262" as const,
      vehicleId: p.vehicleId,
      freestreamMach: p.freestreamMach,
      freestreamVelocityMPerSec,
      obliqueShockAngleDeg,
      normalShockPressureRatio,
      stagnationHeatFluxMwPerM2,
      maxTpsHeatFluxMwPerM2: p.maxTpsHeatFluxMwPerM2,
      isolatorUnstartMargin,
      specificImpulseSec,
      regime,
    };
    const hypersonicAeroDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, hypersonicAeroDigestSha256 });
  }

  evaluate(options: HypersonicScramjetOptions = {}): HypersonicScramjetAssessment {
    return EosHypersonicAerothermodynamicsScramjetCore.evaluateHypersonicAerothermodynamicsScramjet(options);
  }
}

export const evaluateHypersonicAerothermodynamicsScramjet =
  EosHypersonicAerothermodynamicsScramjetCore.evaluateHypersonicAerothermodynamicsScramjet;
