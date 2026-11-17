/**
 * EOS System — Speculative Multi-Token Draft Verification & Paged KV-Cache Types
 * SPEC-317 / CHANGE-179
 *
 * Sovereign, zero-dependency virtual memory page table mapping and
 * parallel speculative decoding verification types.
 */

export interface PhysicalBlock {
  readonly blockId: number;
  isAllocated: boolean;
  sequenceId?: string;
  logicalPage?: number;
  allocatedAtMs?: number;
}

export interface SequenceState {
  readonly sequenceId: string;
  tokens: number[];
  pageTable: number[];
  totalCapacityTokens: number;
  lastAccessMs: number;
}

export interface PagedKvCacheConfig {
  readonly totalBlocks?: number;
  readonly blockSizeTokens?: number;
  readonly headDim?: number;
}

export interface SpeculativeDraftResult {
  readonly sequenceId: string;
  readonly candidateTokens: number[];
  readonly draftProbabilities: number[];
  readonly draftLatencyMs: number;
}

export interface SpeculativeVerifyResult {
  readonly sequenceId: string;
  readonly candidateTokens: number[];
  readonly acceptedTokens: number[];
  readonly correctionToken: number;
  readonly totalEmittedTokens: number[];
  readonly acceptanceRate: number;
  readonly theoreticalSpeedup: number;
  readonly verifiedLatencyMs: number;
  readonly finalSequenceLength: number;
}

export interface PagedKvCacheAuditReport {
  readonly totalBlocks: number;
  readonly allocatedBlocks: number;
  readonly freeBlocks: number;
  readonly activeSequences: number;
  readonly externalFragmentationRatio: number;
  readonly conservationVerified: boolean;
  readonly pageTableMonotonicityVerified: boolean;
  readonly noSharedBlocksVerified: boolean;
  readonly sha256Receipt: string;
}
