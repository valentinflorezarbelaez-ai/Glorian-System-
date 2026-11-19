/**
 * @fileoverview Type definitions for EosFleetChaosMonkey.
 *
 * Implements SPEC-364 / CHANGE-226: Fleet Chaos Monkey & Autonomous FDIR Engine.
 * Pure Layer-0 types with zero external dependencies.
 */

export type ChaosVector =
  | "CORRUPTED_AST"
  | "BROKEN_MERKLE_ROOT"
  | "SPLIT_BRAIN_RAFT_PARTITION"
  | "BUFFER_SATURATION_SPIKE"
  | "DRIFTED_OPENSPEC"
  | "LATENCY_INJECTION";

export type FdirState = "HEALTHY" | "FAULT_INJECTED" | "DETECTED" | "ISOLATED" | "HEALING" | "RECOVERED";

export type FleetRepositoryId =
  | "aberamentho"
  | "atp-strength"
  | "biblioteca-gnostica-1"
  | "control-de-asistencia-abopack"
  | "crud-slack"
  | "donaciones"
  | "eos-system"
  | "performance-talent-group"
  | "portafolio";

export interface ChaosExperimentConfig {
  /** Vector of chaos perturbation to inject */
  readonly vector: ChaosVector;
  /** Target fleet repository to perturb */
  readonly targetRepo: FleetRepositoryId;
  /** Maximum allowable MTTR threshold in milliseconds (default: 500ms) */
  readonly maxMttrThresholdMs?: number;
}

export interface ChaosExperiment {
  readonly experimentId: string;
  readonly vector: ChaosVector;
  readonly targetRepo: FleetRepositoryId;
  readonly injectedAt: number;
  readonly detectedAt: number;
  readonly isolatedAt: number;
  readonly recoveredAt: number;
  readonly detectionLatencyMs: number;
  readonly isolationLatencyMs: number;
  readonly recoveryLatencyMs: number;
  readonly totalMttrMs: number;
  readonly fdirState: FdirState;
  readonly preSnapshotDigest: string;
  readonly postRecoveryDigest: string;
}

export interface FleetResilienceBenchmark {
  readonly benchmarkId: string;
  readonly timestamp: number;
  readonly totalExperiments: number;
  readonly successfulRecoveries: number;
  readonly averageMttrMs: number;
  readonly maxMttrMs: number;
  readonly mttrTargetConforming: boolean;
  readonly evaluatedRepos: readonly FleetRepositoryId[];
  readonly integrityHash: string;
}

export interface EosFleetChaosReceipt {
  readonly receiptId: string;
  readonly specId: "SPEC-364";
  readonly changeId: "CHANGE-226";
  readonly timestamp: number;
  readonly totalExperiments: number;
  readonly fleetRepositoriesCount: number;
  readonly certifiedAverageMttrMs: number;
  readonly checks: {
    readonly multiVectorFaultInjection: "PASS" | "FAIL";
    readonly sub50msAnomalyDetection: "PASS" | "FAIL";
    readonly sandboxedBlastRadiusIsolation: "PASS" | "FAIL";
    readonly raftSwarmRemediation: "PASS" | "FAIL";
    readonly sub500msMttrCertification: "PASS" | "FAIL";
    readonly zeroDependencyPurity: "PASS" | "FAIL";
  };
  readonly integrityHash: string;
}
