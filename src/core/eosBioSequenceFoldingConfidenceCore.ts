/**
 * SPEC-104 / CHANGE-127 — Layer-0 Bio-Sequence Alignment & Folding Confidence Core.
 * Inspired by Google DeepMind AlphaFold 3 (`pLDDT`, `PAE`, steric clash guards, Smith-Waterman).
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  BioFoldVerdict,
  BioFoldingOptions,
  BioFoldingReport,
  ResiduePoint3D,
} from "./eosBioSequenceFoldingConfidenceCore.types.ts";

export type {
  BioFoldVerdict,
  BioFoldingOptions,
  BioFoldingReport,
  ResiduePoint3D,
} from "./eosBioSequenceFoldingConfidenceCore.types.ts";

const CANONICAL_AA_REGEX = /^[ACDEFGHIKLMNPQRSTVWY]+$/;
const DEFAULT_SEQUENCE = "MKTAYIAKQRQISFVK";
const STERIC_CLASH_THRESHOLD_ANGSTROM = 2.0;
const CONTACT_THRESHOLD_ANGSTROM = 8.0;

function generateDefaultHelixCoordinates(length: number): readonly ResiduePoint3D[] {
  const coords: ResiduePoint3D[] = [];
  const twistRad = (100 * Math.PI) / 180;
  for (let i = 0; i < length; i += 1) {
    const x = Number((2.3 * Math.cos(i * twistRad)).toFixed(4));
    const y = Number((2.3 * Math.sin(i * twistRad)).toFixed(4));
    const z = Number((1.5 * i).toFixed(4));
    coords.push([x, y, z]);
  }
  return coords;
}

function round4(v: number): number {
  return Number(v.toFixed(4));
}

function normalizeProteinSequence(raw: string, fieldName: string): string {
  const normalized = raw.trim().toUpperCase();
  assertPrecondition(normalized.length > 0, `${fieldName} must be non-empty.`);
  assertPrecondition(
    CANONICAL_AA_REGEX.test(normalized),
    `${fieldName} contains non-canonical amino acid characters outside the 20 standard residues.`,
  );
  return normalized;
}

function computeSmithWaterman(
  query: string,
  reference: string,
  matchScore: number,
  mismatchPenalty: number,
  gapPenalty: number,
): { readonly maxScore: number; readonly identityRatio: number } {
  const m = query.length;
  const n = reference.length;
  const matrix: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  let maxScore = 0;
  let bestI = 0;
  let bestJ = 0;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const sub = query[i - 1] === reference[j - 1] ? matchScore : mismatchPenalty;
      const diag = matrix[i - 1][j - 1] + sub;
      const up = matrix[i - 1][j] + gapPenalty;
      const left = matrix[i][j - 1] + gapPenalty;
      const val = Math.max(0, diag, up, left);
      matrix[i][j] = val;
      if (val > maxScore) {
        maxScore = val;
        bestI = i;
        bestJ = j;
      }
    }
  }

  let exactMatches = 0;
  let i = bestI;
  let j = bestJ;
  while (i > 0 && j > 0 && matrix[i][j] > 0) {
    const sub = query[i - 1] === reference[j - 1] ? matchScore : mismatchPenalty;
    if (matrix[i][j] === matrix[i - 1][j - 1] + sub) {
      if (query[i - 1] === reference[j - 1]) exactMatches += 1;
      i -= 1;
      j -= 1;
    } else if (matrix[i][j] === matrix[i - 1][j] + gapPenalty) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return { maxScore, identityRatio: round4(exactMatches / Math.max(m, n, 1)) };
}

function inspectBackboneGeometry(coords: readonly ResiduePoint3D[]): {
  readonly contactPairsCount: number;
  readonly stericClashCount: number;
  readonly minNonAdjacentDistance: number;
} {
  for (const pt of coords) {
    assertPrecondition(
      Array.isArray(pt) && pt.length === 3 && pt.every((n) => Number.isFinite(n)),
      "Each 3D C-alpha coordinate must be a finite [x, y, z] triple.",
    );
  }
  let contactPairsCount = 0;
  let stericClashCount = 0;
  let minNonAdjacentDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < coords.length; i += 1) {
    for (let j = i + 2; j < coords.length; j += 1) {
      const dx = coords[i][0] - coords[j][0];
      const dy = coords[i][1] - coords[j][1];
      const dz = coords[i][2] - coords[j][2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < minNonAdjacentDistance) minNonAdjacentDistance = dist;
      if (dist < STERIC_CLASH_THRESHOLD_ANGSTROM) stericClashCount += 1;
      if (dist < CONTACT_THRESHOLD_ANGSTROM) contactPairsCount += 1;
    }
  }
  const safeMinDist = Number.isFinite(minNonAdjacentDistance) ? round4(minNonAdjacentDistance) : 0;
  return { contactPairsCount, stericClashCount, minNonAdjacentDistance: safeMinDist };
}

function resolveFoldVerdict(stericClashCount: number, meanPlddt: number, meanPaeAngstrom: number): BioFoldVerdict {
  if (stericClashCount > 0) return "STERIC_VIOLATION_REJECTED";
  if (meanPlddt < 70 || meanPaeAngstrom > 5.0) return "DISORDERED_LOW_CONFIDENCE";
  return "HIGH_CONFIDENCE_FOLD";
}

export class EosBioSequenceFoldingConfidenceCore {
  static evaluateFoldingAndSequenceAlignment(options: BioFoldingOptions = {}): BioFoldingReport {
    const normalizedSequence = normalizeProteinSequence(options.sequence ?? DEFAULT_SEQUENCE, "sequence");
    const normalizedReferenceSequence = normalizeProteinSequence(
      options.referenceSequence ?? normalizedSequence,
      "referenceSequence",
    );

    const matchScore = options.matchScore ?? 3;
    const mismatchPenalty = options.mismatchPenalty ?? -2;
    const gapPenalty = options.gapPenalty ?? -2;
    assertPrecondition(Number.isFinite(matchScore) && matchScore > 0, "matchScore must be > 0.");

    const caCoordinates = options.caCoordinates ?? generateDefaultHelixCoordinates(normalizedSequence.length);
    assertPrecondition(
      caCoordinates.length === normalizedSequence.length,
      "caCoordinates length must match sequence length.",
    );

    const plddt = options.plddtPerResidue ?? new Array<number>(normalizedSequence.length).fill(92);
    assertPrecondition(
      plddt.length === normalizedSequence.length,
      "plddtPerResidue length must match sequence length.",
    );
    for (const score of plddt) {
      assertPrecondition(Number.isFinite(score) && score >= 0 && score <= 100, "pLDDT scores must lie in [0, 100].");
    }

    const meanPaeAngstrom = options.meanPaeAngstrom ?? 2.1;
    assertPrecondition(Number.isFinite(meanPaeAngstrom) && meanPaeAngstrom >= 0, "meanPaeAngstrom must be >= 0.");

    const alignment = computeSmithWaterman(
      normalizedSequence,
      normalizedReferenceSequence,
      matchScore,
      mismatchPenalty,
      gapPenalty,
    );
    const geometry = inspectBackboneGeometry(caCoordinates);
    const meanPlddt = round4(plddt.reduce((a, b) => a + b, 0) / plddt.length);
    const verdict = resolveFoldVerdict(geometry.stericClashCount, meanPlddt, meanPaeAngstrom);

    const payload = {
      specId: "SPEC-104" as const,
      sequenceLength: normalizedSequence.length,
      normalizedSequence,
      normalizedReferenceSequence,
      smithWatermanMaxScore: alignment.maxScore,
      alignmentIdentityRatio: alignment.identityRatio,
      contactPairsCount: geometry.contactPairsCount,
      stericClashCount: geometry.stericClashCount,
      minNonAdjacentDistanceAngstrom: geometry.minNonAdjacentDistance,
      meanPlddt,
      meanPaeAngstrom: round4(meanPaeAngstrom),
      verdict,
    };

    const bioFoldDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, bioFoldDigestSha256 });
  }
}
