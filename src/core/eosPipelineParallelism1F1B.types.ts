/**
 * @file eosPipelineParallelism1F1B.types.ts
 * @description Type definitions for SPEC-322 / CHANGE-184: Pipeline Parallelism
 * Engine (1F1B Interleaved Activation Schedule & Micro-Batching).
 */

export type PipelinePhase = "WARMUP" | "STEADY_STATE_1F1B" | "COOLDOWN" | "DONE";

export interface PipelineStageConfig {
  stageId: number;
  numStages: number;
  predecessorStageId: number | null;
  successorStageId: number | null;
  weights: number[][];
}

export interface MicroBatchPayload {
  microBatchId: number;
  data: number[][];
}

export interface PipelineScheduleConfig {
  /** Number of pipeline stages P (>= 2, default: 4). */
  numStages?: number;
  /** Total number of micro-batches M (>= numStages, default: 8). */
  numMicroBatches?: number;
  /** Micro-batch size B_micro (default: 2). */
  microBatchSize?: number;
  /** Sequence/feature dimension across stages (default: 4). */
  dimension?: number;
}

export interface StepScheduleAction {
  step: number;
  stageId: number;
  action: "FORWARD" | "BACKWARD" | "IDLE";
  microBatchId: number | null;
  phase: PipelinePhase;
  stashedActivationsCount: number;
}

export interface PipelineExecutionResult {
  numStages: number;
  numMicroBatches: number;
  totalScheduleSteps: number;
  bubbleSteps: number;
  bubbleFraction: number;
  theoreticalBubbleFraction: number;
  peakActivationsPerStage: Record<number, number>;
  activationMemoryBounded: boolean;
  zeroLeakageVerified: boolean;
  completedForwardCount: number;
  completedBackwardCount: number;
  elapsedMs: number;
}

export interface PipelineAuditReceipt {
  schemaVersion: string;
  specRef: string;
  changeRef: string;
  auditStatus: "VERIFIED" | "FAILED";
  numStages: number;
  numMicroBatches: number;
  maxStashedActivations: number;
  peakMemoryBoundedCertified: boolean;
  zeroLeakageCertified: boolean;
  bubbleFractionOptimal: boolean;
  sha256Receipt: string;
  timestampIso: string;
}
