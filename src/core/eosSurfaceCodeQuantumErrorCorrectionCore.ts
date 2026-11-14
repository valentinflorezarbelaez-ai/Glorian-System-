/**
 * SPEC-101 / CHANGE-127 — Layer-0 Rotated Surface Code Quantum Error Correction Core.
 * Inspired by Google Quantum AI Willow / Bravyi-Kitaev 15-to-1 magic-state factory QEC.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  DefectMatchedPair,
  SurfaceCodeDistanceProfile,
  SurfaceCodeQecOptions,
  SurfaceCodeQecReport,
  SurfaceCodeVerdict,
  SyndromeDefectCoordinate,
} from "./eosSurfaceCodeQuantumErrorCorrectionCore.types.ts";

export type {
  DefectMatchedPair,
  SurfaceCodeDistanceProfile,
  SurfaceCodeQecOptions,
  SurfaceCodeQecReport,
  SurfaceCodeVerdict,
  SyndromeDefectCoordinate,
} from "./eosSurfaceCodeQuantumErrorCorrectionCore.types.ts";

const DEFAULT_DISTANCES: readonly number[] = [3, 5, 7];
const DEFAULT_DEFECTS: readonly SyndromeDefectCoordinate[] = [
  { row: 0, col: 1 },
  { row: 1, col: 2 },
  { row: 3, col: 4 },
  { row: 4, col: 4 },
];
const MAGIC_STATE_RATIO_15_TO_1 = 15;

function round12(value: number): number {
  return Number(value.toPrecision(12));
}

function validateQecOptions(
  distances: readonly number[],
  physicalErrorRate: number,
  thresholdErrorRate: number,
  targetLogicalErrorRate: number,
  logicalQubitCount: number,
  magicStateFactories: number,
): readonly number[] {
  assertPrecondition(distances.length > 0, "distances must contain at least one odd integer >= 3.");
  for (const d of distances) {
    assertPrecondition(
      Number.isInteger(d) && d >= 3 && d % 2 === 1,
      `Surface code distance '${String(d)}' must be an odd integer >= 3.`,
    );
  }
  assertPrecondition(
    Number.isFinite(physicalErrorRate) && physicalErrorRate > 0 && physicalErrorRate < 1,
    "physicalErrorRate must be in the open interval (0, 1).",
  );
  assertPrecondition(
    Number.isFinite(thresholdErrorRate) && thresholdErrorRate > 0 && thresholdErrorRate < 1,
    "thresholdErrorRate must be in the open interval (0, 1).",
  );
  assertPrecondition(
    Number.isFinite(targetLogicalErrorRate) && targetLogicalErrorRate > 0 && targetLogicalErrorRate < 1,
    "targetLogicalErrorRate must be in the open interval (0, 1).",
  );
  assertPrecondition(
    Number.isInteger(logicalQubitCount) && logicalQubitCount >= 1,
    "logicalQubitCount must be an integer >= 1.",
  );
  assertPrecondition(
    Number.isInteger(magicStateFactories) && magicStateFactories >= 0,
    "magicStateFactories must be a non-negative integer.",
  );
  return Array.from(new Set(distances)).sort((a, b) => a - b);
}

function evaluateDistanceProfiles(
  sortedDistances: readonly number[],
  lambdaFactor: number,
): { readonly profiles: readonly SurfaceCodeDistanceProfile[]; readonly monotonic: boolean } {
  const profiles: SurfaceCodeDistanceProfile[] = [];
  let prevRate = Number.POSITIVE_INFINITY;
  let monotonic = lambdaFactor > 1;

  for (const distance of sortedDistances) {
    const dataQubits = distance * distance;
    const ancillaQubits = distance * distance - 1;
    const physicalQubitsPerLogical = 2 * distance * distance - 1;
    const rawRate = 0.1 * Math.pow(lambdaFactor, -(distance + 1) / 2);
    const logicalErrorRate = round12(Math.min(0.5, rawRate));
    if (profiles.length > 0 && logicalErrorRate >= prevRate) {
      monotonic = false;
    }
    const suppressionGainRatio =
      profiles.length === 0 ? 1 : round12(prevRate / Math.max(logicalErrorRate, Number.MIN_VALUE));
    prevRate = logicalErrorRate;
    profiles.push({
      distance,
      dataQubits,
      ancillaQubits,
      physicalQubitsPerLogical,
      logicalErrorRate,
      suppressionGainRatio,
    });
  }
  return { profiles, monotonic };
}

function matchDefectsGreedy(defects: readonly SyndromeDefectCoordinate[]): {
  readonly matched: readonly DefectMatchedPair[];
  readonly remainder: number;
} {
  for (const coord of defects) {
    assertPrecondition(
      Number.isInteger(coord.row) && Number.isInteger(coord.col) && coord.row >= 0 && coord.col >= 0,
      "Syndrome defect coordinates must be non-negative integers.",
    );
  }
  const used = new Array<boolean>(defects.length).fill(false);
  const matched: DefectMatchedPair[] = [];

  for (let i = 0; i < defects.length; i += 1) {
    if (used[i]) continue;
    let bestJ = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let j = i + 1; j < defects.length; j += 1) {
      if (used[j]) continue;
      const dist = Math.abs(defects[i].row - defects[j].row) + Math.abs(defects[i].col - defects[j].col);
      if (dist < bestDist) {
        bestDist = dist;
        bestJ = j;
      }
    }
    if (bestJ !== -1) {
      used[i] = true;
      used[bestJ] = true;
      matched.push({ a: defects[i], b: defects[bestJ], manhattanDistance: bestDist });
    }
  }
  return { matched, remainder: defects.length % 2 };
}

function selectTargetProfile(
  profiles: readonly SurfaceCodeDistanceProfile[],
  targetLogicalErrorRate: number,
  lambdaFactor: number,
): SurfaceCodeDistanceProfile {
  if (lambdaFactor <= 1) return profiles[profiles.length - 1];
  return profiles.find((p) => p.logicalErrorRate <= targetLogicalErrorRate) ?? profiles[profiles.length - 1];
}

function resolveVerdict(
  physicalErrorRate: number,
  thresholdErrorRate: number,
  lambdaFactor: number,
  achievedLogicalErrorRate: number,
  targetLogicalErrorRate: number,
  remainder: number,
): SurfaceCodeVerdict {
  if (physicalErrorRate >= thresholdErrorRate || lambdaFactor <= 1) {
    return "ABOVE_FAULT_THRESHOLD_HALT";
  }
  if (achievedLogicalErrorRate > targetLogicalErrorRate || remainder > 0) {
    return "INSUFFICIENT_CODE_DISTANCE";
  }
  return "BELOW_THRESHOLD_SUPPRESSION";
}

export class EosSurfaceCodeQuantumErrorCorrectionCore {
  static auditSurfaceCodeLogicalFidelity(options: SurfaceCodeQecOptions = {}): SurfaceCodeQecReport {
    const physicalErrorRate = options.physicalErrorRate ?? 0.0025;
    const thresholdErrorRate = options.thresholdErrorRate ?? 0.01;
    const targetLogicalErrorRate = options.targetLogicalErrorRate ?? 1e-3;
    const logicalQubitCount = options.logicalQubitCount ?? 1;
    const magicStateFactories = options.magicStateFactories ?? 1;
    const syndromeDefects = options.syndromeDefects ?? DEFAULT_DEFECTS;

    const sortedDistances = validateQecOptions(
      options.distances ?? DEFAULT_DISTANCES,
      physicalErrorRate,
      thresholdErrorRate,
      targetLogicalErrorRate,
      logicalQubitCount,
      magicStateFactories,
    );

    const lambdaFactor = round12(thresholdErrorRate / physicalErrorRate);
    const { profiles, monotonic } = evaluateDistanceProfiles(sortedDistances, lambdaFactor);
    const { matched, remainder } = matchDefectsGreedy(syndromeDefects);
    const selectedProfile = selectTargetProfile(profiles, targetLogicalErrorRate, lambdaFactor);
    const magicStateFactoryQubits =
      magicStateFactories * MAGIC_STATE_RATIO_15_TO_1 * selectedProfile.physicalQubitsPerLogical;
    const totalPhysicalQubitsRequired =
      logicalQubitCount * selectedProfile.physicalQubitsPerLogical + magicStateFactoryQubits;

    const verdict = resolveVerdict(
      physicalErrorRate,
      thresholdErrorRate,
      lambdaFactor,
      selectedProfile.logicalErrorRate,
      targetLogicalErrorRate,
      remainder,
    );

    const payload = {
      specId: "SPEC-101" as const,
      physicalErrorRate,
      thresholdErrorRate,
      lambdaFactor,
      targetLogicalErrorRate,
      exponentialSuppressionVerified: lambdaFactor > 1 && monotonic,
      distancesEvaluated: profiles,
      selectedDistance: selectedProfile.distance,
      achievedLogicalErrorRate: selectedProfile.logicalErrorRate,
      physicalQubitsPerLogical: selectedProfile.physicalQubitsPerLogical,
      logicalQubitCount,
      magicStateFactories,
      magicStateFactoryQubits,
      totalPhysicalQubitsRequired,
      stabilizerDefectsInputCount: syndromeDefects.length,
      stabilizerDefectsMatched: matched,
      unmatchedDefectRemainder: remainder,
      verdict,
    };

    const qecDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, qecDigestSha256 });
  }
}
