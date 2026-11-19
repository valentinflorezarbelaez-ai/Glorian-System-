/**
 * @fileoverview Type definitions for EosAutonomousSentinelDaemon.
 *
 * Implements SPEC-362 / CHANGE-224: Autonomous Continuous Sentinel Daemon 24/7.
 * Pure Layer-0 types with zero external dependencies.
 */

export type SentinelDaemonState =
  "STOPPED" | "STARTING" | "IDLE" | "PROBING" | "ANOMALY_TRIAGE" | "REMEDIATING" | "PAUSED" | "ERROR";

export type SentinelPillar = "LEDGER" | "SPEC_AST" | "GIT_TREE" | "RAFT_SWARM" | "FLEET_SOUNDCHECK";

export type SentinelSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SentinelEpistemicState =
  | "AUDIT_EXECUTED"
  | "FINDINGS_IDENTIFIED"
  | "REMEDIATION_REQUIRED"
  | "REMEDIATION_IN_PROGRESS"
  | "REVALIDATION_REQUIRED"
  | "VERIFIED";

export interface SentinelDaemonConfig {
  /** Heartbeat cadence in milliseconds (default: 60000ms / 60s) */
  readonly heartbeatIntervalMs?: number;
  /** Whether to auto-dispatch remediation leases to Raft swarm */
  readonly autoRemediate?: boolean;
  /** Maximum number of retry attempts before pausing */
  readonly maxRemediationRetries?: number;
  /** Root directory of repository */
  readonly projectRoot?: string;
}

export interface SentinelHealthProbe {
  readonly name: string;
  readonly pillar: SentinelPillar;
  readonly status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  readonly latencyMs: number;
  readonly details: Record<string, unknown>;
}

export interface SentinelAnomalyFinding {
  readonly findingId: string;
  readonly pillar: SentinelPillar;
  readonly severity: SentinelSeverity;
  readonly epistemicState: SentinelEpistemicState;
  readonly description: string;
  readonly timestamp: number;
  readonly affectedSpecs: readonly string[];
  readonly targetFiles: readonly string[];
}

export interface SelfHealingLease {
  readonly leaseId: string;
  readonly findingId: string;
  readonly assignedAgentId: string;
  readonly leaseTtlMs: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly status: "ACTIVE" | "FULFILLED" | "EXPIRED" | "REVOKED";
}

export interface AutonomousPrProposal {
  readonly prId: string;
  readonly title: string;
  readonly branchName: string;
  readonly commitMessage: string;
  readonly diffSummary: string;
  readonly cegisProofVerified: boolean;
  readonly zeroSecretsVerified: boolean;
  readonly patchDigest: string;
  readonly timestamp: number;
}

export interface SentinelHealthReport {
  readonly reportId: string;
  readonly timestamp: number;
  readonly heartbeatTick: number;
  readonly daemonState: SentinelDaemonState;
  readonly overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  readonly probes: readonly SentinelHealthProbe[];
  readonly activeFindings: readonly SentinelAnomalyFinding[];
  readonly activeLeases: readonly SelfHealingLease[];
  readonly stagedPrs: readonly AutonomousPrProposal[];
  readonly integrityHash: string;
}

export interface EosAutonomousSentinelReceipt {
  readonly receiptId: string;
  readonly specId: "SPEC-362";
  readonly changeId: "CHANGE-224";
  readonly timestamp: number;
  readonly daemonState: SentinelDaemonState;
  readonly heartbeatTicksExecuted: number;
  readonly totalProbesRun: number;
  readonly anomaliesRemediatedCount: number;
  readonly checks: {
    readonly heartbeatLoopNonBlocking: "PASS" | "FAIL";
    readonly multiDimensionalProbes: "PASS" | "FAIL";
    readonly specAstDriftDetection: "PASS" | "FAIL";
    readonly raftSwarmRemediationLease: "PASS" | "FAIL";
    readonly cegisVerifiedPrSynthesis: "PASS" | "FAIL";
    readonly zeroDependencyPurity: "PASS" | "FAIL";
  };
  readonly integrityHash: string;
}
