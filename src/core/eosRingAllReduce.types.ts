/**
 * @file eosRingAllReduce.types.ts
 * @description Type definitions for SPEC-320 / CHANGE-182: Ring All-Reduce
 * Distributed Tensor Parallelism & Collective Communication Engine.
 */

export interface RingWorkerNode {
  workerId: number;
  successorId: number;
  predecessorId: number;
  localTensor: number[];
  chunks: number[][];
}

export interface RingAllReduceConfig {
  /** Number of participating workers in the logical ring P (>= 2, default: 4). */
  workerCount?: number;
  /** Tolerance threshold for mathematical parity check (default: 1e-6). */
  tolerance?: number;
}

export interface RingStepTelemetry {
  phase: "SCATTER_REDUCE" | "ALL_GATHER";
  step: number;
  bytesTransferredPerWorker: number;
  elapsedMs: number;
}

export interface RingAllReduceResult {
  /** The final reduced and synchronized tensor replicated across all workers. */
  synchronizedTensor: number[];
  workerCount: number;
  tensorLength: number;
  chunkSize: number;
  totalPaddingElements: number;
  totalCommunicationSteps: number;
  bytesTransferredPerWorker: number;
  maxAbsoluteErrorAgainstCentral: number;
  isMathematicallyEquivalent: boolean;
  elapsedMs: number;
}

export interface RingAuditReceipt {
  schemaVersion: string;
  specRef: string;
  changeRef: string;
  auditStatus: "VERIFIED" | "FAILED";
  workerCount: number;
  tensorLength: number;
  chunkSize: number;
  totalCommunicationSteps: number;
  bytesTransferredPerWorker: number;
  maxAbsoluteError: number;
  ringSymmetryCertified: boolean;
  bandwidthBoundCertified: boolean;
  sha256Receipt: string;
  timestampIso: string;
}
