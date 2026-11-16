/**
 * GLORIAN SYSTEM — AUTONOMOUS RECONCILIATION LOOP TYPES
 *
 * Formal contracts for fleet telemetry observation, bi-temporal graph orientation,
 * atomic DAG convergence planning, surgical self-healing, and cryptographic receipts.
 *
 * Governed by SPEC-307 (FR-307-01..FR-307-06, BDD-1617..BDD-1622).
 * Strict Law V: Zero third-party runtime dependencies.
 */

import type { OrphanLinkAnomaly, TarjanCycleReport } from "./eosFdirOntology.types.ts";

export interface FleetProjectStatus {
  readonly projectId: string;
  readonly repoName: string;
  readonly productionUrl: string;
  readonly status: "REGISTERED" | "UNREACHABLE" | "UNKNOWN";
  readonly authorizedTier: string;
}

export interface FleetObservationReport {
  readonly timestampIso: string;
  readonly totalProjectsCount: number;
  readonly projects: readonly FleetProjectStatus[];
  readonly fleetMerkleRoot: string;
}

export interface ReconciliationOrientationReport {
  readonly status: "OPTIMAL_HARMONY" | "REMEDIATION_REQUIRED";
  readonly totalAnomaliesCount: number;
  readonly orphanAnomalies: readonly OrphanLinkAnomaly[];
  readonly cyclicDeadlocks: readonly TarjanCycleReport[];
  readonly evaluatedAtIso: string;
}

export type ReconciliationActionType =
  "ACTION_PURGE_ORPHAN" | "ACTION_BREAK_CYCLE" | "ACTION_WASM_INTEGRITY_CHECK" | "ACTION_SEAL_MERKLE";

export interface ReconciliationTask {
  readonly taskId: string;
  readonly type: ReconciliationActionType;
  readonly targetEntityId: string;
  readonly description: string;
  readonly dependencies: readonly string[];
  readonly status: "PENDING" | "EXECUTING" | "COMPLETED" | "FAILED";
}

export interface ReconciliationPlanDAG {
  readonly planId: string;
  readonly tasks: readonly ReconciliationTask[];
  readonly estimatedCycles: number;
  readonly generatedAtIso: string;
}

export interface ReconciliationExecutionReport {
  readonly planId: string;
  readonly totalTasks: number;
  readonly executedTasks: number;
  readonly failedTasks: number;
  readonly postExecutionHarmony: "OPTIMAL_HARMONY" | "REMEDIATION_REQUIRED";
  readonly durationUs: number;
  readonly completedAtIso: string;
}

export interface ReconciliationAuditReceipt {
  readonly receiptType: "EOS_RECONCILIATION_LOOP_AUDIT";
  readonly timestampIso: string;
  readonly specRef: "SPEC-307";
  readonly fleetObservedProjects: number;
  readonly convergenceAchieved: boolean;
  readonly tasksExecutedCount: number;
  readonly remainingAnomaliesCount: number;
  readonly wasmKernelAccelerated: boolean;
  readonly sha256Signature: string;
}
