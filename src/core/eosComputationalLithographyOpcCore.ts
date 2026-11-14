/**
 * src/core/eosComputationalLithographyOpcCore.ts
 * SPEC-254 / CHANGE-128: High-NA EUV Computational Lithography & OPC Reticle Mask Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertClosedRange,
  assertFiniteMin,
  assertFiniteNonNegative,
  assertFinitePositive,
  assertHalfOpenRightRange,
  assertIntMin,
  assertOpenRange,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  ComputationalLithographyOpcOptions,
  ComputationalLithographyOpcReport,
  ComputationalLithographyVerdict,
} from "./eosComputationalLithographyOpcCore.types.ts";

function resolveValidatedOpcParams(options: ComputationalLithographyOpcOptions) {
  return {
    processNode: pickNonEmptyString(options.processNode, "2nm-HighNA-EUV"),
    wavelengthNm: assertFinitePositive(pickDefined(options.wavelengthNm, 13.5), "wavelengthNm"),
    numericalAperture: assertOpenRange(
      pickDefined(options.numericalAperture, 0.55),
      0,
      1.5,
      "numericalAperture must be in (0, 1.5).",
    ),
    k1ProcessFactor: assertClosedRange(
      pickDefined(options.k1ProcessFactor, 0.32),
      0.25,
      1.0,
      "k1ProcessFactor must obey Abbe physical bound [0.25, 1.0].",
    ),
    targetCdNm: assertFinitePositive(pickDefined(options.targetCdNm, 8.0), "targetCdNm"),
    targetPitchNm: assertFinitePositive(pickDefined(options.targetPitchNm, 16.0), "targetPitchNm"),
    maskContrast: assertHalfOpenRightRange(
      pickDefined(options.maskContrast, 0.88),
      0,
      1,
      "maskContrast must be in (0, 1].",
    ),
    opcIterations: assertIntMin(pickDefined(options.opcIterations, 6), 1, "opcIterations"),
    initialEpeNm: assertFiniteNonNegative(pickDefined(options.initialEpeNm, 1.8), "initialEpeNm"),
    maxEpeToleranceNm: assertFinitePositive(pickDefined(options.maxEpeToleranceNm, 0.25), "maxEpeToleranceNm"),
    meef: assertFiniteMin(
      pickDefined(options.reticleErrorEnhancementFactor, 1.45),
      1.0,
      "reticleErrorEnhancementFactor must be >= 1.0.",
    ),
    doseFocusWindowPct: assertFiniteNonNegative(pickDefined(options.doseFocusWindowPct, 8.5), "doseFocusWindowPct"),
  };
}

function classifyLithoVerdict(
  targetCdNm: number,
  targetPitchNm: number,
  rayleighHalfPitchNm: number,
  nils: number,
  residualEpeNm: number,
  maxEpeToleranceNm: number,
  doseFocusWindowPct: number,
): ComputationalLithographyVerdict {
  if (
    targetCdNm < 0.75 * rayleighHalfPitchNm ||
    targetPitchNm < 1.5 * rayleighHalfPitchNm ||
    nils < 1.2 ||
    residualEpeNm > maxEpeToleranceNm * 3.5
  ) {
    return "DIFFRACTION_LIMIT_BREACH";
  }
  if (residualEpeNm > maxEpeToleranceNm || nils < 1.8 || doseFocusWindowPct < 5.0) {
    return "SRAF_ASSIST_REQUIRED";
  }
  return "LITHO_OPC_CONVERGED";
}

export class EosComputationalLithographyOpcCore {
  static evaluateComputationalLithographyOpc(
    options: ComputationalLithographyOpcOptions = {},
  ): ComputationalLithographyOpcReport {
    const p = resolveValidatedOpcParams(options);
    const rayleighHalfPitchNm = round6((p.k1ProcessFactor * p.wavelengthNm) / p.numericalAperture);
    const nils = round6(Math.PI * p.maskContrast * (p.targetCdNm / rayleighHalfPitchNm));
    const depthOfFocusNm = round6(0.5 * (p.wavelengthNm / (p.numericalAperture * p.numericalAperture)));
    const residualEpeNm = round6(p.initialEpeNm * Math.pow(0.55, p.opcIterations));
    const effectiveMef = round6(p.meef * (rayleighHalfPitchNm / p.targetCdNm));
    const verdict = classifyLithoVerdict(
      p.targetCdNm,
      p.targetPitchNm,
      rayleighHalfPitchNm,
      nils,
      residualEpeNm,
      p.maxEpeToleranceNm,
      p.doseFocusWindowPct,
    );
    const convergedWithinTolerance = verdict === "LITHO_OPC_CONVERGED";
    const payload = {
      specId: "SPEC-254" as const,
      processNode: p.processNode,
      wavelengthNm: p.wavelengthNm,
      numericalAperture: p.numericalAperture,
      k1ProcessFactor: p.k1ProcessFactor,
      targetCdNm: p.targetCdNm,
      targetPitchNm: p.targetPitchNm,
      rayleighHalfPitchNm,
      nils,
      depthOfFocusNm,
      opcIterations: p.opcIterations,
      initialEpeNm: p.initialEpeNm,
      residualEpeNm,
      maxEpeToleranceNm: p.maxEpeToleranceNm,
      effectiveMef,
      doseFocusWindowPct: p.doseFocusWindowPct,
      convergedWithinTolerance,
      verdict,
    };
    const opcDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, opcDigestSha256 });
  }
}

export const evaluateComputationalLithographyOpc =
  EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc;
