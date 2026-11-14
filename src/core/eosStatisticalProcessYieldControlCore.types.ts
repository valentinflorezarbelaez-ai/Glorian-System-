/**
 * SPEC-252 / CHANGE-126 — Type contracts for EosStatisticalProcessYieldControlCore.
 */

export type SpcYieldVerdict = "SIX_SIGMA_LOCKED" | "SPC_DRIFT_WARNING" | "PROCESS_EXCURSION_HALT";

export interface SpcYieldAuditOptions {
  readonly processId?: string;
  readonly samples?: readonly number[];
  readonly lsl?: number;
  readonly usl?: number;
  readonly target?: number;
  readonly cusumSlackSigma?: number;
  readonly cusumLimitSigma?: number;
  readonly ewmaLambda?: number;
  readonly criticalAreaCm2?: number;
  readonly defectDensityPerCm2?: number;
}

export interface SpcYieldAuditReport {
  readonly processId: string;
  readonly sampleCount: number;
  readonly lsl: number;
  readonly usl: number;
  readonly target: number;
  readonly mean: number;
  readonly stdDev: number;
  readonly ucl: number;
  readonly lcl: number;
  readonly cp: number;
  readonly cpk: number;
  readonly maxCusumHigh: number;
  readonly maxCusumLow: number;
  readonly cusumThreshold: number;
  readonly cusumDriftDetected: boolean;
  readonly ewmaFinal: number;
  readonly outOfControlPointsCount: number;
  readonly excursionIndices: readonly number[];
  readonly criticalAreaCm2: number;
  readonly defectDensityPerCm2: number;
  readonly poissonYieldPercent: number;
  readonly murphyYieldPercent: number;
  readonly verdict: SpcYieldVerdict;
  readonly spcDigestSha256: string;
}
