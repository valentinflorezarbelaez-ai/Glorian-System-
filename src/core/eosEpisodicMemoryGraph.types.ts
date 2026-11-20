/**
 * EOS Sovereign Control Plane — Layer-0 Pure TypeScript
 * Module: Episodic Memory Graph & Cross-Project Experience Synapse Types
 * Specification: SPEC-369 / CHANGE-231
 * Requirements: FR-369-01 through FR-369-07
 * Invariants: Zero external dependencies, pure mechanical sympathy, line ceiling <= 800
 */

export type SynapseEdgeType = "CAUSAL_DEPENDENCY" | "SIMILAR_SYMPTOM" | "SHARED_SOLUTION" | "MUTATION_DERIVATIVE";

export interface EpisodicNode {
  id: string;
  repoId: string;
  symptom: string;
  rootCause: string;
  solutionPatch: string;
  verificationReceipt: string;
  tokens: string[];
  weight: number;
  accessCount: number;
  lastAccessedAt: number;
  createdAt: number;
  pinned: boolean;
}

export interface SynapticEdge {
  sourceId: string;
  targetId: string;
  edgeType: SynapseEdgeType;
  weight: number;
  confidence: number;
}

export interface EpisodeIngestInput {
  repoId: string;
  symptom: string;
  rootCause: string;
  solutionPatch: string;
  verificationReceipt?: string;
  pinned?: boolean;
}

export interface EpisodicQueryResult {
  node: EpisodicNode;
  similarityScore: number;
  crossRepoTransfer: boolean;
  synapticHops: number;
  causalChain: string[];
}

export interface CausalTraversalPath {
  originId: string;
  path: string[];
  cumulativeConfidence: number;
}

export interface EpisodicMemoryStats {
  totalNodes: number;
  totalEdges: number;
  repoDistribution: Record<string, number>;
  averageWeight: number;
  prunedNodesCount: number;
}

export interface EpisodicMemoryGraphReceipt {
  receiptId: string;
  sha256: string;
  stats: EpisodicMemoryStats;
  topEpisodes: EpisodicNode[];
  generatedAt: string;
}
