/**
 * @file eosTensorParallelAttention.types.ts
 * @description Type definitions for SPEC-323 / CHANGE-185: Tensor Parallel
 * Multi-Head & Grouped-Query Attention (TP-MHA / TP-GQA) with Sequence
 * Parallelism and Ring Attention.
 */

export interface AttentionHeadPartition {
  workerId: number;
  workerCount: number;
  qHeadIndices: number[];
  kvHeadIndices: number[];
  numQHeads: number;
  numKVHeads: number;
  headDim: number;
}

export interface TensorParallelAttentionConfig {
  /** Number of tensor parallel workers P (P >= 2). */
  workerCount: number;
  /** Total number of query heads H_Q (must be divisible by P). */
  totalQHeads: number;
  /** Total number of key/value heads H_KV (must divide totalQHeads and be divisible by P). */
  totalKVHeads: number;
  /** Dimension per head d_k (default: 4). */
  headDim?: number;
  /** Total hidden dimension d = totalQHeads * headDim. */
  hiddenDim?: number;
}

export interface AttentionWeightsShard {
  workerId: number;
  /** Column-parallel projection shard for Q: shape [d, (H_Q / P) * d_k] */
  wqShard: number[][];
  /** Column-parallel projection shard for K: shape [d, (H_KV / P) * d_k] */
  wkShard: number[][];
  /** Column-parallel projection shard for V: shape [d, (H_KV / P) * d_k] */
  wvShard: number[][];
  /** Row-parallel projection shard for Output: shape [(H_Q / P) * d_k, d] */
  woShard: number[][];
}

export interface TensorParallelAttentionResult {
  output: number[][][];
  allReduceCount: number;
  workerCount: number;
  totalQHeads: number;
  totalKVHeads: number;
  isMathEquivalent: boolean;
  maxAbsoluteError: number;
}

export interface RingAttentionResult {
  output: number[][][];
  numRingSteps: number;
  localSequenceLength: number;
  totalSequenceLength: number;
  isExactMatch: boolean;
  maxAbsoluteError: number;
}

export interface TensorParallelAttentionAuditReceipt {
  schemaVersion: string;
  specRef: string;
  changeRef: string;
  auditStatus: "VERIFIED" | "FAILED";
  workerCount: number;
  totalQHeads: number;
  totalKVHeads: number;
  headConservationCertified: boolean;
  singleBarrierCertified: boolean;
  mathParityCertified: boolean;
  ringAttentionCertified: boolean;
  sha256Receipt: string;
  timestampIso: string;
}
