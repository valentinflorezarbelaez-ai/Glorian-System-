/**
 * EOS Expert Parallelism & Mixture-of-Experts (MoE) Routing Engine - Domain Types
 * Part of SPEC-325 / CHANGE-187.
 *
 * Provides type contracts for Top-K sparse routing, capacity factor bounded buffers,
 * auxiliary load-balancing loss, and two-phase All-to-All collective dispatch/combine.
 */

export interface ExpertPartition {
  workerId: number;
  expertIndices: number[];
  numLocalExperts: number;
}

export interface TopKRouteResult {
  tokenIndex: number;
  selectedExperts: number[];
  gatingWeights: Float32Array;
  isDropped: boolean[];
}

export interface MoERoutingBatch {
  tokenCount: number;
  numExperts: number;
  topK: number;
  capacityPerExpert: number;
  routes: TopKRouteResult[];
  tokensPerExpert: number[];
  totalDroppedSlots: number;
  gatingProbabilities: Float32Array[];
  auxiliaryLoss: number;
}

export interface MoEConfig {
  totalExperts: number;
  topK: number;
  numWorkers: number;
  hiddenDim: number;
  capacityFactor?: number;
  auxLossCoeff?: number;
}

export interface MoEOutput {
  outputRepresentations: Float32Array[];
  dispatchedTokensCount: number;
  auxiliaryLoss: number;
  droppedTokensCount: number;
  mathParityPassed: boolean;
}

export interface MoEAuditReceipt {
  status: "VERIFIED" | "FAILED";
  numWorkers: number;
  totalExperts: number;
  topK: number;
  tokensEvaluated: number;
  capacityBoundedCertified: boolean;
  auxLossMinimaCertified: boolean;
  mathParityCertified: boolean;
  zeroLeakageCertified: boolean;
  sha256Receipt: string;
  timestamp: string;
}
