/**
 * src/core/eosSubseaCoherentDwdmNonlinearShannonCore.ts
 * SPEC-261 / CHANGE-129: Subsea Coherent DWDM Gaussian Noise Kerr Nonlinearity & Shannon Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertClosedRange,
  assertFinitePositive,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round12,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  SubseaDwdmRegime,
  SubseaDwdmShannonAssessment,
  SubseaDwdmShannonOptions,
} from "./eosSubseaCoherentDwdmNonlinearShannonCore.types.ts";

const PHOTON_ENERGY_1550NM_J = 1.2815e-19;

export const DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS: Readonly<Required<SubseaDwdmShannonOptions>> = deepFreeze({
  cableId: "SUBSEA-TRANSATLANTIC-SDM-01",
  spanCount: 82,
  spanLengthKm: 80.0,
  fiberAttenuationDbPerKm: 0.155,
  edfaNoiseFigureDb: 4.5,
  channelBaudRateGbaud: 96.0,
  wDMChannelCount: 64,
  launchPowerDbm: -0.5,
  nonlinearKerrCoeffPerWKm: 0.35,
  minGeneralizedSnrDb: 11.5,
});

function resolveValidatedDwdmParams(options: SubseaDwdmShannonOptions) {
  return {
    cableId: pickNonEmptyString(options.cableId, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.cableId),
    spanCount: assertIntMin(
      pickDefined(options.spanCount, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.spanCount),
      1,
      "spanCount",
    ),
    spanLengthKm: assertFinitePositive(
      pickDefined(options.spanLengthKm, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.spanLengthKm),
      "spanLengthKm",
    ),
    fiberAttenuationDbPerKm: assertFinitePositive(
      pickDefined(options.fiberAttenuationDbPerKm, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.fiberAttenuationDbPerKm),
      "fiberAttenuationDbPerKm",
    ),
    edfaNoiseFigureDb: assertFinitePositive(
      pickDefined(options.edfaNoiseFigureDb, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.edfaNoiseFigureDb),
      "edfaNoiseFigureDb",
    ),
    channelBaudRateGbaud: assertFinitePositive(
      pickDefined(options.channelBaudRateGbaud, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.channelBaudRateGbaud),
      "channelBaudRateGbaud",
    ),
    wDMChannelCount: assertIntMin(
      pickDefined(options.wDMChannelCount, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.wDMChannelCount),
      1,
      "wDMChannelCount",
    ),
    launchPowerDbm: assertClosedRange(
      pickDefined(options.launchPowerDbm, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.launchPowerDbm),
      -20,
      15,
      "launchPowerDbm must be in [-20, 15] dBm.",
    ),
    nonlinearKerrCoeffPerWKm: assertFinitePositive(
      pickDefined(options.nonlinearKerrCoeffPerWKm, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.nonlinearKerrCoeffPerWKm),
      "nonlinearKerrCoeffPerWKm",
    ),
    minGeneralizedSnrDb: assertFinitePositive(
      pickDefined(options.minGeneralizedSnrDb, DEFAULT_SUBSEA_DWDM_SHANNON_OPTIONS.minGeneralizedSnrDb),
      "minGeneralizedSnrDb",
    ),
  };
}

function classifyDwdmRegime(gsnrDb: number, minGsnrDb: number, nliW: number, aseW: number): SubseaDwdmRegime {
  if (gsnrDb < minGsnrDb) return "OSNR_BELOW_FEC_THRESHOLD";
  if (nliW > 0.55 * aseW) return "KERR_NONLINEAR_SATURATION";
  return "OPTIMAL_NONLINEAR_SHANNON";
}

export class EosSubseaCoherentDwdmNonlinearShannonCore {
  static evaluateSubseaCoherentDwdmNonlinearShannon(
    options: SubseaDwdmShannonOptions = {},
  ): SubseaDwdmShannonAssessment {
    const p = resolveValidatedDwdmParams(options);
    const spanGainLin = Math.pow(10, (p.fiberAttenuationDbPerKm * p.spanLengthKm) / 10);
    const launchPowerWatts = Math.pow(10, (p.launchPowerDbm - 30) / 10);
    const alphaNpPerKm = (p.fiberAttenuationDbPerKm * Math.LN10) / 10;
    const effectiveLengthKm = round6((1 - Math.exp(-alphaNpPerKm * p.spanLengthKm)) / alphaNpPerKm);

    const nfLin = Math.pow(10, p.edfaNoiseFigureDb / 10);
    const aseRaw = p.spanCount * PHOTON_ENERGY_1550NM_J * nfLin * (spanGainLin - 1) * (p.channelBaudRateGbaud * 1e9);
    const nliRaw =
      p.spanCount *
      (8 / 27) *
      p.nonlinearKerrCoeffPerWKm *
      p.nonlinearKerrCoeffPerWKm *
      effectiveLengthKm *
      effectiveLengthKm *
      Math.log(1 + (p.wDMChannelCount * p.wDMChannelCount) / 4) *
      Math.pow(launchPowerWatts, 3);

    const gsnrLin = launchPowerWatts / (aseRaw + nliRaw);
    const generalizedSnrDb = round6(10 * Math.log10(gsnrLin));
    const spectralEfficiencyBpsPerHz = round6(2 * Math.log2(1 + gsnrLin));
    const totalFiberPairCapacityTbps = round6(
      (p.wDMChannelCount * p.channelBaudRateGbaud * spectralEfficiencyBpsPerHz) / 1000,
    );
    const regime = classifyDwdmRegime(generalizedSnrDb, p.minGeneralizedSnrDb, nliRaw, aseRaw);

    const payload = {
      specId: "SPEC-261" as const,
      cableId: p.cableId,
      spanCount: p.spanCount,
      spanLengthKm: p.spanLengthKm,
      wDMChannelCount: p.wDMChannelCount,
      channelBaudRateGbaud: p.channelBaudRateGbaud,
      launchPowerDbm: p.launchPowerDbm,
      effectiveLengthKm,
      aseNoisePowerWatts: round12(aseRaw),
      kerrNliPowerWatts: round12(nliRaw),
      generalizedSnrDb,
      minGeneralizedSnrDb: p.minGeneralizedSnrDb,
      spectralEfficiencyBpsPerHz,
      totalFiberPairCapacityTbps,
      regime,
    };
    const subseaDwdmDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, subseaDwdmDigestSha256 });
  }

  evaluate(options: SubseaDwdmShannonOptions = {}): SubseaDwdmShannonAssessment {
    return EosSubseaCoherentDwdmNonlinearShannonCore.evaluateSubseaCoherentDwdmNonlinearShannon(options);
  }
}

export const evaluateSubseaCoherentDwdmNonlinearShannon =
  EosSubseaCoherentDwdmNonlinearShannonCore.evaluateSubseaCoherentDwdmNonlinearShannon;
