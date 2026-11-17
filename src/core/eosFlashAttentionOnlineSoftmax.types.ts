/**
 * @file eosFlashAttentionOnlineSoftmax.types.ts
 * @description Type definitions for SPEC-318 / CHANGE-180: FlashAttention-Style
 * Online Softmax Tiling & Block-Paged Attention Kernel.
 */

export interface FlashAttentionConfig {
  /** Head feature dimension d (e.g. 16, 32, 64, 128). */
  headDim: number;
  /** Query row block size Br (default: 16). */
  blockSizeRow?: number;
  /** Key/Value column block size Bc (default: 16). */
  blockSizeCol?: number;
  /** Whether to enforce lower-triangular causal attention masking. */
  isCausal?: boolean;
  /** Custom score scaling factor (default: 1 / sqrt(headDim)). */
  scale?: number;
}

export interface RunningRowStats {
  rowIndex: number;
  runningMax: number;
  runningSum: number;
  accumulatedOutput: number[];
}

export interface TileExecutionMetadata {
  rowBlockIndex: number;
  colBlockIndex: number;
  isPruned: boolean;
  rowTokensCount: number;
  colTokensCount: number;
  localMax?: number[];
  localSum?: number[];
}

export interface FlashAttentionForwardResult {
  /** Computed output matrix [Nq][d]. */
  output: number[][];
  /** Number of query row blocks. */
  totalRowBlocks: number;
  /** Number of key/value column blocks. */
  totalColBlocks: number;
  /** Total tile pairs (Tr * Tc). */
  totalTiles: number;
  /** Evaluated tile pairs. */
  evaluatedTiles: number;
  /** Pruned tile pairs due to causal boundary optimization. */
  prunedTiles: number;
  /** Additional workspace memory bound in bytes: O(Br * d + Bc * d). */
  workingMemoryBytes: number;
  /** Theoretical FLOP count for forward evaluation. */
  theoreticalFlops: number;
  /** Wall-clock kernel execution time in milliseconds. */
  elapsedMs: number;
}

export interface FlashAttentionParityResult {
  isEquivalent: boolean;
  maxAbsoluteError: number;
  relativeError: number;
  tolerance: number;
  flashOutputSample: number[];
  naiveOutputSample: number[];
}

export interface FlashAttentionAuditReceipt {
  schemaVersion: string;
  specRef: string;
  changeRef: string;
  auditStatus: "VERIFIED" | "FAILED";
  headDim: number;
  sequenceLengthQ: number;
  sequenceLengthK: number;
  totalTiles: number;
  evaluatedTiles: number;
  prunedTiles: number;
  workingMemoryBytes: number;
  maxAbsoluteError: number;
  relativeError: number;
  numericalStabilityCertified: boolean;
  workingMemoryBounded: boolean;
  sha256Receipt: string;
  timestampIso: string;
}
