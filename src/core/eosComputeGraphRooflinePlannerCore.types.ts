/**
 * SPEC-251 / CHANGE-126 — Type contracts for EosComputeGraphRooflinePlannerCore.
 */

export type ComputeOpKind = "MATMUL" | "BIAS_ADD" | "RELU" | "LAYERNORM" | "ATTN_SCORE" | "REDUCE";

export type RooflineBoundRegime = "COMPUTE_BOUND" | "MEMORY_BOUND";

export type ComputeGraphRooflineVerdict = "ROOFLINE_OPTIMIZED" | "ARENA_BUDGET_EXCEEDED";

export interface ComputeGraphNodeInput {
  readonly id: string;
  readonly opKind: ComputeOpKind;
  readonly flops: number;
  readonly bytesRead: number;
  readonly bytesWritten: number;
  readonly outputBytes: number;
  readonly dependencies: readonly string[];
}

export interface ComputeGraphRooflineOptions {
  readonly hardwareName?: string;
  readonly peakFlopsGiga?: number;
  readonly memoryBandwidthGBps?: number;
  readonly memoryBudgetBytes?: number;
  readonly alignBytes?: number;
  readonly nodes?: readonly ComputeGraphNodeInput[];
}

export interface OperatorRooflineProfile {
  readonly id: string;
  readonly opKind: ComputeOpKind;
  readonly arithmeticIntensityFlopsPerByte: number;
  readonly attainableGflops: number;
  readonly boundRegime: RooflineBoundRegime;
  readonly utilizationRatio: number;
}

export interface FusedOperatorGroup {
  readonly groupId: string;
  readonly nodeIds: readonly string[];
  readonly pattern: string;
  readonly memoryTrafficSavedBytes: number;
}

export interface ArenaBufferAllocation {
  readonly nodeId: string;
  readonly offsetBytes: number;
  readonly sizeBytes: number;
  readonly alignedSizeBytes: number;
}

export interface ComputeGraphRooflineReport {
  readonly hardwareName: string;
  readonly peakFlopsGiga: number;
  readonly memoryBandwidthGBps: number;
  readonly ridgePointFlopsPerByte: number;
  readonly memoryBudgetBytes: number;
  readonly alignBytes: number;
  readonly totalNodes: number;
  readonly executionOrder: readonly string[];
  readonly operatorProfiles: readonly OperatorRooflineProfile[];
  readonly fusedGroups: readonly FusedOperatorGroup[];
  readonly fusedOperatorsCount: number;
  readonly memoryTrafficSavedBytes: number;
  readonly arenaAllocations: readonly ArenaBufferAllocation[];
  readonly peakArenaBytes: number;
  readonly fragmentationRatio: number;
  readonly verdict: ComputeGraphRooflineVerdict;
  readonly rooflineDigestSha256: string;
}
