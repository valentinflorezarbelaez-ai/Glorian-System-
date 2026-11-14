/**
 * SPEC-101 / CHANGE-127 — Rotated Surface Code QEC & Magic-State Factory Types.
 */

export type SurfaceCodeVerdict =
  "BELOW_THRESHOLD_SUPPRESSION" | "INSUFFICIENT_CODE_DISTANCE" | "ABOVE_FAULT_THRESHOLD_HALT";

export interface SyndromeDefectCoordinate {
  readonly row: number;
  readonly col: number;
}

export interface SurfaceCodeDistanceProfile {
  readonly distance: number;
  readonly dataQubits: number;
  readonly ancillaQubits: number;
  readonly physicalQubitsPerLogical: number;
  readonly logicalErrorRate: number;
  readonly suppressionGainRatio: number;
}

export interface DefectMatchedPair {
  readonly a: SyndromeDefectCoordinate;
  readonly b: SyndromeDefectCoordinate;
  readonly manhattanDistance: number;
}

export interface SurfaceCodeQecOptions {
  readonly distances?: readonly number[];
  readonly physicalErrorRate?: number;
  readonly thresholdErrorRate?: number;
  readonly targetLogicalErrorRate?: number;
  readonly logicalQubitCount?: number;
  readonly magicStateFactories?: number;
  readonly syndromeDefects?: readonly SyndromeDefectCoordinate[];
}

export interface SurfaceCodeQecReport {
  readonly specId: "SPEC-101";
  readonly physicalErrorRate: number;
  readonly thresholdErrorRate: number;
  readonly lambdaFactor: number;
  readonly targetLogicalErrorRate: number;
  readonly exponentialSuppressionVerified: boolean;
  readonly distancesEvaluated: readonly SurfaceCodeDistanceProfile[];
  readonly selectedDistance: number;
  readonly achievedLogicalErrorRate: number;
  readonly physicalQubitsPerLogical: number;
  readonly logicalQubitCount: number;
  readonly magicStateFactories: number;
  readonly magicStateFactoryQubits: number;
  readonly totalPhysicalQubitsRequired: number;
  readonly stabilizerDefectsInputCount: number;
  readonly stabilizerDefectsMatched: readonly DefectMatchedPair[];
  readonly unmatchedDefectRemainder: number;
  readonly verdict: SurfaceCodeVerdict;
  readonly qecDigestSha256: string;
}
