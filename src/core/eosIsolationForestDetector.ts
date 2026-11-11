/**
 * EosIsolationForestDetector (Layer 0 — Streaming Isolation Forest Anomaly Detector)
 * Governed by SPEC-209, CHANGE-094, ADR-094, FR-1064..FR-1068, BDD-1064..BDD-1068 (v79.0.0)
 *
 * Implements:
 * - Unsupervised multidimensional anomaly detection via random recursive partitioning trees (iTrees).
 * - Exact Binary Search Tree average path length correction c(n) with Euler-Mascheroni constant.
 * - Normalized anomaly scoring s(x, psi) = 2^(-E(h(x)) / c(psi)) in [0, 1].
 * - Online streaming sliding window buffer with adaptive retraining and zero runtime dependencies.
 * - Multi-feature importance attribution identifying which dimensions triggered isolation.
 * - Tamper-evident SHA-256 anomaly certificates and detection receipts.
 *
 * Strictly ZERO external runtime dependencies (Law V). Node 24 strip-only compliant.
 */

import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export const EULER_MASCHERONI = 0.5772156649;

export interface IsolationTreeNode {
  readonly isLeaf: boolean;
  readonly size: number;
  readonly splitFeature?: number;
  readonly splitValue?: number;
  readonly left?: IsolationTreeNode;
  readonly right?: IsolationTreeNode;
}

export interface AnomalyScoreResult {
  readonly vector: readonly number[];
  readonly meanPathLength: number;
  readonly anomalyScore: number;
  readonly isAnomaly: boolean;
  readonly topContributingFeature?: number;
}

export interface AnomalyBatchReport {
  readonly totalEvaluated: number;
  readonly anomalyCount: number;
  readonly anomalyRatio: number;
  readonly threshold: number;
  readonly forestTrees: number;
  readonly subsampleSize: number;
  readonly results: readonly AnomalyScoreResult[];
  readonly outliers: readonly AnomalyScoreResult[];
  readonly sha256Receipt: string;
  readonly generatedAt: string;
}

export interface IsolationForestOptions {
  readonly nTrees?: number;
  readonly subsampleSize?: number;
  readonly threshold?: number;
  readonly seed?: number;
}

export interface StreamingForestOptions extends IsolationForestOptions {
  readonly windowCapacity?: number;
  readonly retrainInterval?: number;
}

/**
 * Calculates the average path length of an unsuccessful search in a Binary Search Tree (BST)
 * over n instances, representing the expected isolation depth of normal points.
 */
export function computeAverageBstPathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2.0 * (Math.log(n - 1) + EULER_MASCHERONI) - (2.0 * (n - 1)) / n;
}

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 */
export function createPrng(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Recursively grows a single Isolation Tree (iTree).
 */
export function buildIsolationTree(
  data: readonly (readonly number[])[],
  currentDepth: number,
  maxDepth: number,
  rng: () => number,
): IsolationTreeNode {
  const n = data.length;

  // Stopping conditions: max depth reached, single point, or empty
  if (currentDepth >= maxDepth || n <= 1) {
    return deepFreeze({ isLeaf: true, size: n });
  }

  const numFeatures = data[0].length;
  // Try up to numFeatures random dimensions to find a valid split
  const featureIndices = Array.from({ length: numFeatures }, (_, i) => i);
  for (let i = featureIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = featureIndices[i];
    featureIndices[i] = featureIndices[j];
    featureIndices[j] = tmp;
  }

  let chosenFeature = -1;
  let minVal = 0;
  let maxVal = 0;

  for (const feat of featureIndices) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = data[i][feat];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min < max) {
      chosenFeature = feat;
      minVal = min;
      maxVal = max;
      break;
    }
  }

  // All features have identical values: cannot partition further
  if (chosenFeature === -1) {
    return deepFreeze({ isLeaf: true, size: n });
  }

  // Draw uniform split point p in [minVal, maxVal]
  const splitValue = minVal + rng() * (maxVal - minVal);

  const leftData: (readonly number[])[] = [];
  const rightData: (readonly number[])[] = [];

  for (let i = 0; i < n; i++) {
    const row = data[i];
    if (row[chosenFeature] < splitValue) {
      leftData.push(row);
    } else {
      rightData.push(row);
    }
  }

  // Degenerate partition edge case
  if (leftData.length === 0 || rightData.length === 0) {
    return deepFreeze({ isLeaf: true, size: n });
  }

  const left = buildIsolationTree(leftData, currentDepth + 1, maxDepth, rng);
  const right = buildIsolationTree(rightData, currentDepth + 1, maxDepth, rng);

  return deepFreeze({
    isLeaf: false,
    size: n,
    splitFeature: chosenFeature,
    splitValue,
    left,
    right,
  });
}

/**
 * Measures the traversal path length h(x) of instance x in a given iTree.
 */
export function evaluatePathLength(node: IsolationTreeNode, x: readonly number[], currentDepth = 0): number {
  if (node.isLeaf) {
    return currentDepth + computeAverageBstPathLength(node.size);
  }

  assertPrecondition(node.splitFeature !== undefined, "Internal node missing splitFeature");
  assertPrecondition(node.splitValue !== undefined, "Internal node missing splitValue");

  if (x[node.splitFeature] < node.splitValue) {
    return evaluatePathLength(node.left!, x, currentDepth + 1);
  } else {
    return evaluatePathLength(node.right!, x, currentDepth + 1);
  }
}

/**
 * Batch Isolation Forest Model.
 */
export class EosIsolationForest {
  readonly nTrees: number;
  readonly subsampleSize: number;
  readonly threshold: number;
  readonly seed: number;

  private _trees: IsolationTreeNode[] = [];
  private _actualSubsample = 256;
  private _cFactor = 1.0;
  private _isFitted = false;

  constructor(options: IsolationForestOptions = {}) {
    this.nTrees = options.nTrees ?? 100;
    this.subsampleSize = options.subsampleSize ?? 256;
    this.threshold = options.threshold ?? 0.6;
    this.seed = options.seed ?? 42;

    assertPrecondition(this.nTrees >= 1, "nTrees must be >= 1");
    assertPrecondition(this.subsampleSize >= 2, "subsampleSize must be >= 2");
    assertPrecondition(this.threshold > 0 && this.threshold < 1, "threshold must be between 0 and 1");
  }

  get isFitted(): boolean {
    return this._isFitted;
  }

  get trees(): readonly IsolationTreeNode[] {
    return this._trees;
  }

  /**
   * Fits the ensemble of isolation trees on training dataset.
   */
  fit(data: readonly (readonly number[])[]): this {
    assertPrecondition(data.length >= 2, "Dataset must contain at least 2 instances to train forest");
    assertPrecondition(data[0].length >= 1, "Instances must have at least 1 feature dimension");

    const N = data.length;
    this._actualSubsample = Math.min(this.subsampleSize, N);
    const maxDepth = Math.ceil(Math.log2(this._actualSubsample));
    this._cFactor = computeAverageBstPathLength(this._actualSubsample);

    const rng = createPrng(this.seed);
    this._trees = [];

    for (let t = 0; t < this.nTrees; t++) {
      // Subsample without replacement or bootstrap
      const sampleIndices = new Set<number>();
      while (sampleIndices.size < this._actualSubsample) {
        sampleIndices.add(Math.floor(rng() * N));
      }
      const sample = Array.from(sampleIndices).map((idx) => data[idx]);
      const tree = buildIsolationTree(sample, 0, maxDepth, rng);
      this._trees.push(tree);
    }

    this._isFitted = true;
    return this;
  }

  /**
   * Computes the anomaly score s(x, psi) for a single instance vector.
   */
  score(x: readonly number[]): AnomalyScoreResult {
    assertPrecondition(this._isFitted, "Isolation Forest must be fitted before scoring instances");
    assertPrecondition(x.length >= 1, "Vector must have at least 1 feature");

    let totalPathLength = 0;
    const featureEarlyIsolationCount: Record<number, number> = {};

    for (const tree of this._trees) {
      const path = evaluatePathLength(tree, x);
      totalPathLength += path;

      // Track feature that isolated at shallow depth (depth <= 2)
      if (tree.splitFeature !== undefined && path <= 3) {
        featureEarlyIsolationCount[tree.splitFeature] = (featureEarlyIsolationCount[tree.splitFeature] || 0) + 1;
      }
    }

    const meanPathLength = totalPathLength / this.nTrees;
    // Anomaly score: s(x, n) = 2^(-E(h(x)) / c(n))
    const exponent = -meanPathLength / this._cFactor;
    const anomalyScore = Number(Math.pow(2.0, exponent).toFixed(4));
    const isAnomaly = anomalyScore >= this.threshold;

    // Identify top contributing feature
    let topContributingFeature: number | undefined;
    let maxCount = 0;
    for (const [feat, cnt] of Object.entries(featureEarlyIsolationCount)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        topContributingFeature = parseInt(feat, 10);
      }
    }

    return deepFreeze({
      vector: deepFreeze([...x]),
      meanPathLength: Number(meanPathLength.toFixed(4)),
      anomalyScore,
      isAnomaly,
      topContributingFeature,
    });
  }

  /**
   * Evaluates a batch of instances and generates a cryptographic anomaly report.
   */
  predict(data: readonly (readonly number[])[]): AnomalyBatchReport {
    assertPrecondition(this._isFitted, "Isolation Forest must be fitted before predict");
    assertPrecondition(data.length >= 1, "Data array must not be empty");

    const results: AnomalyScoreResult[] = [];
    const outliers: AnomalyScoreResult[] = [];

    for (const row of data) {
      const res = this.score(row);
      results.push(res);
      if (res.isAnomaly) {
        outliers.push(res);
      }
    }

    // Sort outliers by score descending
    outliers.sort((a, b) => b.anomalyScore - a.anomalyScore);

    const reportPayload = {
      totalEvaluated: results.length,
      anomalyCount: outliers.length,
      anomalyRatio: Number((outliers.length / results.length).toFixed(4)),
      threshold: this.threshold,
      forestTrees: this.nTrees,
      subsampleSize: this._actualSubsample,
      outlierCount: outliers.length,
    };

    const sha256Receipt = pureSha256(JSON.stringify(reportPayload));

    return deepFreeze({
      ...reportPayload,
      results: deepFreeze(results),
      outliers: deepFreeze(outliers),
      sha256Receipt,
      generatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Real-Time Streaming Sliding Window Isolation Forest.
 */
export class EosStreamingIsolationForest {
  readonly windowCapacity: number;
  readonly retrainInterval: number;
  private readonly _forest: EosIsolationForest;
  private readonly _window: number[][] = [];
  private _ingestedCount = 0;
  private _isReady = false;

  constructor(options: StreamingForestOptions = {}) {
    this.windowCapacity = options.windowCapacity ?? 300;
    this.retrainInterval = options.retrainInterval ?? 50;

    assertPrecondition(this.windowCapacity >= 10, "windowCapacity must be >= 10");
    assertPrecondition(this.retrainInterval >= 1, "retrainInterval must be >= 1");

    this._forest = new EosIsolationForest(options);
  }

  get windowSize(): number {
    return this._window.length;
  }

  get ingestedCount(): number {
    return this._ingestedCount;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Ingest a single streaming data vector into the sliding window.
   */
  ingest(vector: readonly number[]): AnomalyScoreResult | null {
    assertPrecondition(vector.length >= 1, "Vector must be non-empty");

    this._window.push([...vector]);
    if (this._window.length > this.windowCapacity) {
      this._window.shift(); // Evict oldest
    }

    this._ingestedCount++;

    // Initial training when minimum window threshold reached
    if (!this._isReady && this._window.length >= Math.min(30, this.windowCapacity)) {
      this._forest.fit(this._window);
      this._isReady = true;
    } else if (this._isReady && this._ingestedCount % this.retrainInterval === 0) {
      // Periodic online update to reflect temporal drift
      this._forest.fit(this._window);
    }

    if (this._isReady) {
      return this._forest.score(vector);
    }

    return null;
  }

  /**
   * Score an arbitrary vector against the current model.
   */
  score(vector: readonly number[]): AnomalyScoreResult {
    assertPrecondition(this._isReady, "Streaming forest is not yet ready (needs minimum window samples)");
    return this._forest.score(vector);
  }
}
