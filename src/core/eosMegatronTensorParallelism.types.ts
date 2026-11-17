/**
 * @file eosMegatronTensorParallelism.types.ts
 * @description Type definitions for SPEC-321 / CHANGE-183: Megatron-LM Style
 * Tensor Parallelism (Column & Row Linear Sharding).
 */

export type ActivationFunction = "GELU" | "SILU" | "RELU" | "IDENTITY";

export interface MegatronConfig {
  /** Number of tensor parallel workers P (>= 1, default: 2). */
  workerCount?: number;
  /** Input dimension size d_in. */
  inputDimension?: number;
  /** Hidden dimension size d_hidden. Must be divisible by workerCount. */
  hiddenDimension?: number;
  /** Output dimension size d_out. */
  outputDimension?: number;
  /** Activation type for intermediate layer (default: "GELU"). */
  activation?: ActivationFunction;
  /** Numerical tolerance for validation (default: 1e-6). */
  tolerance?: number;
}

export interface ShardedWeights {
  workerId: number;
  /** Column-parallel slice of W1 for this worker [d_in, d_hidden / P]. */
  w1Shard: number[][];
  /** Row-parallel slice of W2 for this worker [d_hidden / P, d_out]. */
  w2Shard: number[][];
}

export interface MegatronMlpResult {
  /** Final synchronized output tensor replicated across all workers [B, d_out]. */
  synchronizedOutput: number[][];
  workerCount: number;
  batchSize: number;
  inputDimension: number;
  hiddenDimension: number;
  outputDimension: number;
  hiddenPerWorker: number;
  totalAllReduceBarriers: number;
  bytesTransferredPerWorker: number;
  maxAbsoluteErrorAgainstCentral: number;
  isMathematicallyEquivalent: boolean;
  elapsedMs: number;
}

export interface ShardedCrossEntropyResult {
  loss: number;
  workerCount: number;
  batchSize: number;
  vocabularySize: number;
  vocabPerWorker: number;
  maxAbsoluteErrorAgainstCentral: number;
  isLossEquivalent: boolean;
}

export interface MegatronAuditReceipt {
  schemaVersion: string;
  specRef: string;
  changeRef: string;
  auditStatus: "VERIFIED" | "FAILED";
  workerCount: number;
  batchSize: number;
  inputDimension: number;
  hiddenDimension: number;
  outputDimension: number;
  vocabularySize: number;
  singleBarrierCertified: boolean;
  numericalParityCertified: boolean;
  shardedCrossEntropyCertified: boolean;
  sha256Receipt: string;
  timestampIso: string;
}
