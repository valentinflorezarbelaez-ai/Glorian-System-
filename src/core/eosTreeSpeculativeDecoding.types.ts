/**
 * Glorian System — Tree-Structured Speculative Decoding & Multi-Candidate Rejection Sampling Engine
 * Governed by SPEC-330 / CHANGE-192 / ADR-192-001..003
 *
 * Invariant: Pure Layer-0 TypeScript. Zero external runtime dependencies.
 * Maximum lines <= 800 (SPEC-250 compliant).
 */

export interface SpeculativeTreeNode {
  readonly nodeId: number;
  readonly tokenId: number;
  readonly depth: number;
  readonly parentId: number | null;
  readonly childrenIds: readonly number[];
  readonly draftProbability: number;
}

export interface DraftTreeTopology {
  readonly rootNodeId: number;
  readonly nodes: readonly SpeculativeTreeNode[];
  readonly flattenedTokenIds: readonly number[];
  readonly positionIds: readonly number[];
  readonly maxDepth: number;
  readonly totalNodes: number;
}

export interface TreeAttentionMask {
  readonly dimension: number;
  readonly maskData: Uint8Array;
  readonly rowMajorIndices: readonly (readonly number[])[];
}

export interface CandidateLogitsDistribution {
  readonly nodeId: number;
  readonly targetDistribution: Float32Array;
  readonly draftDistribution: Float32Array;
}

export interface RejectionSamplingNodeVerdict {
  readonly nodeId: number;
  readonly tokenId: number;
  readonly isAccepted: boolean;
  readonly targetProb: number;
  readonly draftProb: number;
  readonly ratio: number;
}

export interface RejectionSamplingResult {
  readonly acceptedNodeIds: readonly number[];
  readonly rejectedNodeIds: readonly number[];
  readonly longestAcceptedPathTokenIds: readonly number[];
  readonly recoveryTokenId: number;
  readonly finalEmittedTokens: readonly number[];
  readonly acceptanceRateAlpha: number;
  readonly zeroKLDivergenceVerified: boolean;
  readonly speedupEstimate: number;
}

export interface TreeTopologyModulation {
  readonly historicalAlpha: number;
  readonly recommendedDepth: number;
  readonly recommendedBranchingFactor: number;
  readonly projectedSpeedup: number;
  readonly mode: "EXPAND_TREE" | "SUSTAIN" | "CONTRACT_TREE";
}

export interface TreeSpeculativeAuditReceipt {
  readonly specRef: "SPEC-330";
  readonly engine: string;
  readonly timestampIso: string;
  readonly vocabSize: number;
  readonly treeDepth: number;
  readonly branchingFactor: number;
  readonly totalCandidateNodes: number;
  readonly treeMaskAncestryVerified: boolean;
  readonly guaranteedProgressVerified: boolean;
  readonly zeroKLDivergenceVerified: boolean;
  readonly speedupRatio: number;
  readonly status: "TREE_SPECULATIVE_DECODING_VERIFIED";
  readonly sha256Signature: string;
}
