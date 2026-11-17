/**
 * Glorian System — Activation Checkpointing & Recomputation Engine Types
 * Governed by SPEC-326 / CHANGE-188 / ADR-188-001..003
 */

export type CheckpointPolicy = "FULL_CHECKPOINT" | "SELECTIVE_RECOMPUTE";

export interface LayerSpec {
  id: number;
  name: string;
  weights: Float32Array; // shape [inputDim, outputDim]
  bias?: Float32Array; // shape [outputDim]
  isNonLinear?: boolean;
  inputDim: number;
  outputDim: number;
}

export interface LayerGradients {
  layerId: number;
  gradWeights: Float32Array;
  gradBias?: Float32Array;
  gradInput: Float32Array;
}

export interface ActivationCheckpoint {
  segmentIndex: number;
  layerIndex: number;
  activation: Float32Array;
  timestampNs?: number;
}

export interface ForwardResult {
  output: Float32Array;
  checkpoints: Map<number, ActivationCheckpoint>;
  storedActivationsCount: number;
  peakMemoryElements: number;
}

export interface BackwardResult {
  inputGradients: Float32Array;
  layerGradients: LayerGradients[];
  recomputationSteps: number;
  residualMemoryElements: number;
}

export interface StandardPassResult {
  output: Float32Array;
  inputGradients: Float32Array;
  layerGradients: LayerGradients[];
  peakMemoryElements: number;
}

export interface MicroBatchStep {
  stepIndex: number;
  microBatchId: number;
  stageId: number;
  action: "FORWARD" | "BACKWARD";
  activeActivationsCount: number;
}

export interface ActivationAuditReceipt {
  status: "VERIFIED" | "FAILED";
  numLayers: number;
  numSegments: number;
  segmentSize: number;
  policy: CheckpointPolicy;
  peakMemoryCeilingBounded: boolean;
  peakMemoryElements: number;
  standardPeakMemoryElements: number;
  memoryReductionPercent: number;
  gradientParityCertified: boolean;
  maxGradientAbsDiff: number;
  zeroResidualLeakage: boolean;
  residualElements: number;
  timestamp: string;
  sha256?: string;
}
