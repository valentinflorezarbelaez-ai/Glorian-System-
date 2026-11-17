/**
 * Glorian System — StreamingLLM, Attention Sinks & Infinite-Context Window Memory Compression Engine
 * Governed by SPEC-331 / CHANGE-193 / ADR-193-001..003
 *
 * Invariant: Pure Layer-0 TypeScript. Zero external runtime dependencies.
 * Maximum lines <= 800 (SPEC-250 compliant).
 */

export interface StreamingTokenBlock {
  readonly tokenId: number;
  readonly globalPosition: number;
  readonly ropePosition: number;
  readonly isSink: boolean;
  readonly keyTensor: Float32Array;
  readonly valueTensor: Float32Array;
  readonly ingestedAtMs: number;
}

export interface StreamingCacheTopology {
  readonly sinkCapacity: number;
  readonly windowCapacity: number;
  readonly totalCapacity: number;
  readonly currentActiveBlocks: number;
  readonly totalStreamedTokens: number;
  readonly totalEvictedTokens: number;
}

export interface DynamicRopeMapping {
  readonly sinkPositions: readonly number[];
  readonly windowPositions: readonly number[];
  readonly combinedPositions: readonly number[];
  readonly isContiguousInWindow: boolean;
  readonly maxPositionAssigned: number;
}

export interface StreamingAttentionResult {
  readonly queryTokenId: number;
  readonly sinkAttentionMass: number;
  readonly windowAttentionMass: number;
  readonly totalAttentionSum: number;
  readonly attentionEntropy: number;
  readonly sinkMassFractionPercent: number;
  readonly isNormalizingStable: boolean;
}

export interface StreamingEvictionEvent {
  readonly evictedTokenId: number;
  readonly evictedGlobalPosition: number;
  readonly totalEvictedToDate: number;
  readonly wasSinkProtected: boolean;
}

export interface StreamingLlmAuditReceipt {
  readonly specRef: "SPEC-331";
  readonly engine: string;
  readonly timestampIso: string;
  readonly streamLength: number;
  readonly sinkSize: number;
  readonly windowSize: number;
  readonly totalCapacity: number;
  readonly sinkImmunityVerified: boolean;
  readonly memoryCeilingVerified: boolean;
  readonly ropeContiguityVerified: boolean;
  readonly perplexityStabilityVerified: boolean;
  readonly status: "STREAMING_LLM_ATTENTION_SINKS_VERIFIED";
  readonly sha256Signature: string;
}
