/**
 * src/core/eosInterferometricSarDeformationCore.ts
 * SPEC-265 / CHANGE-130: Interferometric SAR Crustal Deformation & Coherence Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFiniteNonNegative,
  assertFinitePositive,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  InSarDeformationAssessment,
  InSarDeformationOptions,
  InSarDeformationRegime,
} from "./eosInterferometricSarDeformationCore.types.ts";

export const DEFAULT_INSAR_DEFORMATION_OPTIONS: Readonly<Required<InSarDeformationOptions>> = deepFreeze({
  passPairId: "SENTINEL1-CSK-TANDEM-FAULT-01",
  radarWavelengthMeters: 0.055465,
  slantRangeKm: 850.0,
  incidenceAngleDeg: 38.0,
  rangeResolutionMeters: 5.0,
  perpendicularBaselineMeters: 180.0,
  temporalBaselineDays: 12.0,
  decorrelationTimeConstantDays: 45.0,
  thermalSnrDb: 16.0,
  unwrappedPhaseRad: 4.25,
  minCoherenceThreshold: 0.45,
});

function assertLeftOpenRightClosed(value: number, min: number, max: number, name: string): number {
  assertPrecondition(
    typeof value === "number" && Number.isFinite(value) && value > min && value <= max,
    `${name} must satisfy ${min} < ${name} <= ${max} (got ${value})`,
  );
  return value;
}

function resolveValidatedInSarParams(options: InSarDeformationOptions) {
  const d = DEFAULT_INSAR_DEFORMATION_OPTIONS;
  const unwrappedPhaseRad = pickDefined(options.unwrappedPhaseRad, d.unwrappedPhaseRad);
  assertPrecondition(
    typeof unwrappedPhaseRad === "number" && Number.isFinite(unwrappedPhaseRad),
    `unwrappedPhaseRad must be finite (got ${unwrappedPhaseRad})`,
  );
  return {
    passPairId: pickNonEmptyString(options.passPairId, d.passPairId),
    radarWavelengthMeters: assertFinitePositive(
      pickDefined(options.radarWavelengthMeters, d.radarWavelengthMeters),
      "radarWavelengthMeters",
    ),
    slantRangeKm: assertFinitePositive(pickDefined(options.slantRangeKm, d.slantRangeKm), "slantRangeKm"),
    incidenceAngleDeg: assertLeftOpenRightClosed(
      pickDefined(options.incidenceAngleDeg, d.incidenceAngleDeg),
      5,
      85,
      "incidenceAngleDeg",
    ),
    rangeResolutionMeters: assertFinitePositive(
      pickDefined(options.rangeResolutionMeters, d.rangeResolutionMeters),
      "rangeResolutionMeters",
    ),
    perpendicularBaselineMeters: assertFinitePositive(
      pickDefined(options.perpendicularBaselineMeters, d.perpendicularBaselineMeters),
      "perpendicularBaselineMeters",
    ),
    temporalBaselineDays: assertFiniteNonNegative(
      pickDefined(options.temporalBaselineDays, d.temporalBaselineDays),
      "temporalBaselineDays",
    ),
    decorrelationTimeConstantDays: assertFinitePositive(
      pickDefined(options.decorrelationTimeConstantDays, d.decorrelationTimeConstantDays),
      "decorrelationTimeConstantDays",
    ),
    thermalSnrDb: assertFinitePositive(pickDefined(options.thermalSnrDb, d.thermalSnrDb), "thermalSnrDb"),
    unwrappedPhaseRad,
    minCoherenceThreshold: assertLeftOpenRightClosed(
      pickDefined(options.minCoherenceThreshold, d.minCoherenceThreshold),
      0,
      1,
      "minCoherenceThreshold",
    ),
  };
}

function classifyInSarRegime(totalCoherence: number, minCoherenceThreshold: number): InSarDeformationRegime {
  if (totalCoherence < minCoherenceThreshold) return "BASELINE_DECORRELATION_CRITICAL";
  if (totalCoherence < 0.65) return "TEMPORAL_DECORRELATION_WARNING";
  return "PHASE_UNWRAPPED_COHERENT";
}

export class EosInterferometricSarDeformationCore {
  static evaluateInterferometricSarDeformation(options: InSarDeformationOptions = {}): InSarDeformationAssessment {
    const p = resolveValidatedInSarParams(options);
    const incRad = (p.incidenceAngleDeg * Math.PI) / 180;
    const criticalBaselineMeters = round6(
      (p.radarWavelengthMeters * (p.slantRangeKm * 1000) * Math.tan(incRad)) / (2 * p.rangeResolutionMeters),
    );
    const geometricCoherence = round6(Math.max(0, 1 - p.perpendicularBaselineMeters / criticalBaselineMeters));
    const temporalCoherence = round6(Math.exp(-p.temporalBaselineDays / p.decorrelationTimeConstantDays));
    const thermalCoherence = round6(1 / (1 + 1 / Math.pow(10, p.thermalSnrDb / 10)));
    const totalCoherence = round6(geometricCoherence * temporalCoherence * thermalCoherence);
    const ambiguityHeightMeters = round6(
      (p.radarWavelengthMeters * (p.slantRangeKm * 1000) * Math.sin(incRad)) / (2 * p.perpendicularBaselineMeters),
    );
    const losDisplacementMm = round6((p.radarWavelengthMeters * 1000 * p.unwrappedPhaseRad) / (4 * Math.PI));
    const cohSq = Math.max(0.05, totalCoherence * totalCoherence);
    const displacementUncertaintyMm = round6(
      ((p.radarWavelengthMeters * 1000) / (4 * Math.PI)) *
        Math.sqrt((1 - totalCoherence * totalCoherence) / (2 * cohSq * 16)),
    );
    const regime = classifyInSarRegime(totalCoherence, p.minCoherenceThreshold);

    const payload = {
      specId: "SPEC-265" as const,
      ...p,
      criticalBaselineMeters,
      geometricCoherence,
      temporalCoherence,
      thermalCoherence,
      totalCoherence,
      ambiguityHeightMeters,
      losDisplacementMm,
      displacementUncertaintyMm,
      regime,
    };
    return deepFreeze({
      ...payload,
      insarDeformationDigestSha256: pureSha256(JSON.stringify(payload)),
    });
  }
}

export function evaluateInterferometricSarDeformation(
  options: InSarDeformationOptions = {},
): InSarDeformationAssessment {
  return EosInterferometricSarDeformationCore.evaluateInterferometricSarDeformation(options);
}
