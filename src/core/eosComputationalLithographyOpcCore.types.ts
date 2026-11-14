/**
 * src/core/eosComputationalLithographyOpcCore.types.ts
 * SPEC-254 / CHANGE-128: High-NA EUV Computational Lithography & OPC Reticle Mask Core Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type ComputationalLithographyVerdict =
  "LITHO_OPC_CONVERGED" | "SRAF_ASSIST_REQUIRED" | "DIFFRACTION_LIMIT_BREACH";

export interface ComputationalLithographyOpcOptions {
  readonly processNode?: string;
  readonly wavelengthNm?: number;
  readonly numericalAperture?: number;
  readonly k1ProcessFactor?: number;
  readonly targetCdNm?: number;
  readonly targetPitchNm?: number;
  readonly maskContrast?: number;
  readonly opcIterations?: number;
  readonly initialEpeNm?: number;
  readonly maxEpeToleranceNm?: number;
  readonly reticleErrorEnhancementFactor?: number;
  readonly doseFocusWindowPct?: number;
}

export interface ComputationalLithographyOpcReport {
  readonly specId: "SPEC-254";
  readonly processNode: string;
  readonly wavelengthNm: number;
  readonly numericalAperture: number;
  readonly k1ProcessFactor: number;
  readonly targetCdNm: number;
  readonly targetPitchNm: number;
  readonly rayleighHalfPitchNm: number;
  readonly nils: number;
  readonly depthOfFocusNm: number;
  readonly opcIterations: number;
  readonly initialEpeNm: number;
  readonly residualEpeNm: number;
  readonly maxEpeToleranceNm: number;
  readonly effectiveMef: number;
  readonly doseFocusWindowPct: number;
  readonly convergedWithinTolerance: boolean;
  readonly verdict: ComputationalLithographyVerdict;
  readonly opcDigestSha256: string;
}
