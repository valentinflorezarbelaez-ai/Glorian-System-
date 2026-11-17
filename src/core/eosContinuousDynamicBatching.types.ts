/**
 * @file eosContinuousDynamicBatching.types.ts
 * @description Type definitions for SPEC-319 / CHANGE-181: Continuous Dynamic
 * Sequence Batching & Iteration-Level Request Scheduler.
 */

export type BatchRequestPriority = "HIGH" | "NORMAL" | "LOW";

export type BatchRequestStatus = "PENDING" | "RUNNING" | "COMPLETED" | "PREEMPTED";

export interface BatchRequest {
  requestId: string;
  promptTokens: number[];
  maxTokens: number;
  priority: BatchRequestPriority;
  status: BatchRequestStatus;
  arrivalTimestamp: number;
  generatedTokens: number[];
  preemptCount: number;
  finishReason?: "EOS" | "MAX_TOKENS" | "PREEMPTED";
  startTime?: number;
  finishTime?: number;
}

export interface BatchSchedulerConfig {
  /** Maximum number of concurrent running sequences in the batch B (e.g. 4, 8, 16, 64). */
  maxBatchSize: number;
  /** End-of-sequence token ID that triggers immediate completion (default: 0). */
  eosTokenId?: number;
  /** Total physical memory blocks available for allocation (default: 64). */
  maxBlocksTotal?: number;
  /** Fixed block size in tokens (default: 16). */
  tokensPerBlock?: number;
}

export interface RunningSlot {
  slotIndex: number;
  request: BatchRequest | null;
  allocatedBlocks: number;
}

export interface StepIterationResult {
  step: number;
  activeSlotCount: number;
  admittedRequestIds: string[];
  finishedRequestIds: string[];
  preemptedRequestIds: string[];
  tokensEmittedThisStep: number;
  elapsedMs: number;
}

export interface BatchMetricsSnapshot {
  totalRequestsServed: number;
  completedRequestsCount: number;
  pendingQueueLength: number;
  activeSlotsCount: number;
  totalTokensGenerated: number;
  averageThroughputTokensPerSec: number;
  averageSlotUtilization: number;
  totalPreemptions: number;
}

export interface BatchAuditReceipt {
  schemaVersion: string;
  specRef: string;
  changeRef: string;
  auditStatus: "VERIFIED" | "FAILED";
  maxBatchSize: number;
  totalRequestsTested: number;
  completedRequestsCount: number;
  activeSlotsBounded: boolean;
  zeroPaddingDensityVerified: boolean;
  noSlotLeaksVerified: boolean;
  preemptionRecoveryVerified: boolean;
  sha256Receipt: string;
  timestampIso: string;
}
