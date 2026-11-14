/**
 * src/core/eosOpticalLatticeAtomicClockRelativisticSyncCore.ts
 * SPEC-264 / CHANGE-130: Optical Lattice Atomic Clock & Relativistic Geodesy Sync Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFiniteNonNegative,
  assertFinitePositive,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  OpticalClockRegime,
  OpticalLatticeClockAssessment,
  OpticalLatticeClockOptions,
} from "./eosOpticalLatticeAtomicClockRelativisticSyncCore.types.ts";

export const DEFAULT_OPTICAL_LATTICE_CLOCK_OPTIONS: Readonly<Required<OpticalLatticeClockOptions>> = deepFreeze({
  clockEnsembleId: "BIPM-SR87-OPTICAL-LATTICE-01",
  clockTransitionFreqThz: 429.228,
  naturalLinewidthMhz: 1.2,
  interrogationAtomCount: 10000,
  averagingTimeSec: 3600,
  ambientTempK: 295.0,
  geopotentialHeightDiffMeters: 12.5,
  fiberLinkPhaseNoiseFs: 0.85,
  maxFractionalInstabilityE18: 2.5,
});

function resolveValidatedClockParams(options: OpticalLatticeClockOptions) {
  const d = DEFAULT_OPTICAL_LATTICE_CLOCK_OPTIONS;
  return {
    clockEnsembleId: pickNonEmptyString(options.clockEnsembleId, d.clockEnsembleId),
    clockTransitionFreqThz: assertFinitePositive(
      pickDefined(options.clockTransitionFreqThz, d.clockTransitionFreqThz),
      "clockTransitionFreqThz",
    ),
    naturalLinewidthMhz: assertFinitePositive(
      pickDefined(options.naturalLinewidthMhz, d.naturalLinewidthMhz),
      "naturalLinewidthMhz",
    ),
    interrogationAtomCount: assertIntMin(
      pickDefined(options.interrogationAtomCount, d.interrogationAtomCount),
      100,
      "interrogationAtomCount",
    ),
    averagingTimeSec: assertFinitePositive(
      pickDefined(options.averagingTimeSec, d.averagingTimeSec),
      "averagingTimeSec",
    ),
    ambientTempK: assertFinitePositive(pickDefined(options.ambientTempK, d.ambientTempK), "ambientTempK"),
    geopotentialHeightDiffMeters: assertFiniteNonNegative(
      pickDefined(options.geopotentialHeightDiffMeters, d.geopotentialHeightDiffMeters),
      "geopotentialHeightDiffMeters",
    ),
    fiberLinkPhaseNoiseFs: assertFinitePositive(
      pickDefined(options.fiberLinkPhaseNoiseFs, d.fiberLinkPhaseNoiseFs),
      "fiberLinkPhaseNoiseFs",
    ),
    maxFractionalInstabilityE18: assertFinitePositive(
      pickDefined(options.maxFractionalInstabilityE18, d.maxFractionalInstabilityE18),
      "maxFractionalInstabilityE18",
    ),
  };
}

function classifyClockRegime(
  combinedInstabilityE18: number,
  maxFractionalInstabilityE18: number,
  fiberLinkPhaseNoiseFs: number,
): OpticalClockRegime {
  if (combinedInstabilityE18 > maxFractionalInstabilityE18) return "ALLAN_STABILITY_BREACH";
  if (combinedInstabilityE18 > 0.8 * maxFractionalInstabilityE18 || fiberLinkPhaseNoiseFs > 2.5) {
    return "BBR_OR_GEOPOTENTIAL_DRIFT_WARN";
  }
  return "FEMTOSECOND_TAI_LOCKED";
}

export class EosOpticalLatticeAtomicClockRelativisticSyncCore {
  static evaluateOpticalLatticeAtomicClockRelativisticSync(
    options: OpticalLatticeClockOptions = {},
  ): OpticalLatticeClockAssessment {
    const p = resolveValidatedClockParams(options);
    const lineQualityFactorQ = round6((p.clockTransitionFreqThz * 1e12) / (p.naturalLinewidthMhz * 1e-3));
    const quantumProjectionSnr = round6(Math.sqrt(p.interrogationAtomCount));
    const allanDeviationE18 = round6(
      (51.0 * p.naturalLinewidthMhz) / (Math.sqrt(p.interrogationAtomCount / 1000) * Math.sqrt(p.averagingTimeSec)),
    );
    const bbrResidualE18 = round6(0.45 * Math.pow(p.ambientTempK / 300.0, 4));
    const gravitationalRedshiftE18 = round6(109.1 * p.geopotentialHeightDiffMeters);
    const geopotentialUncertaintyE18 = round6(0.045 * p.geopotentialHeightDiffMeters);
    const combinedInstabilityE18 = round6(Math.hypot(allanDeviationE18, bbrResidualE18, geopotentialUncertaintyE18));
    const timingSyncUncertaintyFs = round6(Math.hypot(p.fiberLinkPhaseNoiseFs, combinedInstabilityE18 * 0.42));
    const regime = classifyClockRegime(combinedInstabilityE18, p.maxFractionalInstabilityE18, p.fiberLinkPhaseNoiseFs);

    const payload = {
      specId: "SPEC-264" as const,
      ...p,
      lineQualityFactorQ,
      quantumProjectionSnr,
      allanDeviationE18,
      bbrResidualE18,
      gravitationalRedshiftE18,
      geopotentialUncertaintyE18,
      combinedInstabilityE18,
      timingSyncUncertaintyFs,
      regime,
    };
    return deepFreeze({
      ...payload,
      opticalClockDigestSha256: pureSha256(JSON.stringify(payload)),
    });
  }
}

export function evaluateOpticalLatticeAtomicClockRelativisticSync(
  options: OpticalLatticeClockOptions = {},
): OpticalLatticeClockAssessment {
  return EosOpticalLatticeAtomicClockRelativisticSyncCore.evaluateOpticalLatticeAtomicClockRelativisticSync(options);
}
