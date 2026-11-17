/**
 * Glorian System — Distributed Key-Value Cache Replication, Prefix Caching & Speculative KV Prefetching Types
 * Governed by SPEC-329 / CHANGE-191 / ADR-191-001..003
 *
 * Invariant: Pure Layer-0 TypeScript. Zero external runtime dependencies.
 */

export interface KvBlock {
  readonly blockId: string;
  readonly tokenIds: readonly number[];
  readonly isPinned: boolean;
  accessCount: number;
  lastAccessedAt: number;
  readonly keyTensor: Float32Array;
  readonly valueTensor: Float32Array;
  readonly sha256Hash: string;
}

export interface RadixTreeNode {
  readonly nodeId: string;
  readonly tokens: readonly number[];
  readonly blockIds: readonly string[];
  readonly children: Map<number, RadixTreeNode>;
  isLeaf: boolean;
  readonly isPinned: boolean;
}

export interface PrefixMatchResult {
  readonly matchedTokens: readonly number[];
  readonly matchedTokenCount: number;
  readonly totalTokenCount: number;
  readonly hitRatioPercent: number;
  readonly reusedBlockIds: readonly string[];
  readonly newTokensToPrefill: readonly number[];
  readonly ttftEstimatedSpeedupPercent: number;
}

export interface BlockReplicationEvent {
  readonly blockId: string;
  readonly sourceWorkerId: string;
  readonly targetWorkerId: string;
  readonly sha256Hash: string;
  readonly verifiedMatch: boolean;
  readonly replicatedAtIso: string;
}

export interface SpeculativePrefetchResult {
  readonly candidateBeamsCount: number;
  readonly prefetchedBlockIds: readonly string[];
  readonly transferredBytes: number;
  readonly cacheHitProbability: number;
}

export interface KvEvictionResult {
  readonly requestedBlocks: number;
  readonly evictedBlockIds: readonly string[];
  readonly freedMemoryBytes: number;
  readonly pinnedSkippedCount: number;
  readonly remainingCapacityBlocks: number;
}

export interface DistributedKvAuditReceipt {
  readonly specRef: "SPEC-329";
  readonly engine: "Distributed Key-Value Cache Replication, Prefix Caching & Speculative KV Prefetching Engine";
  readonly timestampIso: string;
  readonly numWorkers: number;
  readonly totalPhysicalBlocks: number;
  readonly maxBlockCapacity: number;
  readonly pinnedBlocksCount: number;
  readonly radixTreeDepth: number;
  readonly prefixMatchVerified: boolean;
  readonly peerReplicationVerified: boolean;
  readonly speculativePrefetchVerified: boolean;
  readonly evictionPinnedImmunityVerified: boolean;
  readonly exactAttentionIdentityVerified: boolean;
  readonly status: "DISTRIBUTED_KV_CACHE_REPLICATION_VERIFIED";
  readonly sha256Signature: string;
}
