/**
 * SPEC-104 / CHANGE-127 — Bio-Sequence Alignment & Folding Confidence (`pLDDT` / `PAE`) Types.
 */

export type BioFoldVerdict = "HIGH_CONFIDENCE_FOLD" | "DISORDERED_LOW_CONFIDENCE" | "STERIC_VIOLATION_REJECTED";

export type ResiduePoint3D = readonly [number, number, number];

export interface BioFoldingOptions {
  readonly sequence?: string;
  readonly referenceSequence?: string;
  readonly caCoordinates?: readonly ResiduePoint3D[];
  readonly plddtPerResidue?: readonly number[];
  readonly meanPaeAngstrom?: number;
  readonly matchScore?: number;
  readonly mismatchPenalty?: number;
  readonly gapPenalty?: number;
}

export interface BioFoldingReport {
  readonly specId: "SPEC-104";
  readonly sequenceLength: number;
  readonly normalizedSequence: string;
  readonly normalizedReferenceSequence: string;
  readonly smithWatermanMaxScore: number;
  readonly alignmentIdentityRatio: number;
  readonly contactPairsCount: number;
  readonly stericClashCount: number;
  readonly minNonAdjacentDistanceAngstrom: number;
  readonly meanPlddt: number;
  readonly meanPaeAngstrom: number;
  readonly verdict: BioFoldVerdict;
  readonly bioFoldDigestSha256: string;
}
