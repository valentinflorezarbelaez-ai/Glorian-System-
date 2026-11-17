/**
 * EOS ZeRO and Fully Sharded Data Parallel (FSDP) Engine - Domain Types
 * Part of SPEC-324 / CHANGE-186.
 *
 * Provides type contracts for ZeRO-1 (P_os), ZeRO-2 (P_os+g), and ZeRO-3 / FSDP (P_os+g+p).
 */

export type ZeROStage = 1 | 2 | 3;

export interface OptimizerShard {
  workerId: number;
  startIndex: number;
  endIndex: number;
  length: number;
  m: Float32Array;
  v: Float32Array;
  masterWeights: Float32Array;
}

export interface ParameterShard {
  workerId: number;
  layerId: number;
  startIndex: number;
  endIndex: number;
  shardedValues: Float32Array;
}

export interface ZeROConfig {
  stage: ZeROStage;
  numWorkers: number;
  cpuOffload?: boolean;
  learningRate?: number;
  beta1?: number;
  beta2?: number;
  epsilon?: number;
}

export interface ZeROStepResult {
  stage: ZeROStage;
  numWorkers: number;
  totalParameters: number;
  memoryPerWorkerBytes: number;
  peakTransientBytes: number;
  baselineDdpBytes: number;
  memorySavingsRatio: number;
  communicationBytes: number;
  cpuOffloadActive: boolean;
  stepParityPassed: boolean;
}

export interface ZeROAuditReceipt {
  status: "VERIFIED" | "FAILED";
  stage1MemoryReductionRatio: number;
  stage2MemoryReductionRatio: number;
  stage3MemoryReductionRatio: number;
  mathParityCertified: boolean;
  zeroLeakageCertified: boolean;
  hostOffloadVerified: boolean;
  numWorkersEvaluated: number;
  totalParametersEvaluated: number;
  receiptSha256: string;
  timestamp: string;
}
