/**
 * Glorian System — Sovereign Closed-Loop Repository Autopilot Types
 * Governed by SPEC-340 / CHANGE-202 / ADR-202-001..003
 */

import type { DeshAuditReceipt } from "./eosDiscreteEventSimulationHypervisor.types.ts";
import type { HypergraphAuditReceipt } from "./eosOntologicalHypergraph.types.ts";
import type { CohortTelemetrySummary, HarnessExecutionResult } from "./eosAgenticHarnessYield.types.ts";

export type AutopilotErrorCode =
  "AUTOPILOT_INVALID_ROOT" | "AUTOPILOT_INVALID_PARAMETERS" | "AUTOPILOT_STAGE_VIOLATION";

export type AutopilotStageName = "INGESTION" | "CAUSAL" | "DESH" | "HARNESS";

export interface ClosedLoopAutopilotConfig {
  readonly projectRoot?: string;
  readonly maxEntitiesPerSource?: number;
  readonly commitLimit?: number;
  readonly simulationSeed?: string;
}

export interface RepositoryIngestionReport {
  readonly fleetProjectsCount: number;
  readonly mutationTargetsCount: number;
  readonly tlcModelsVerifiedCount: number;
  readonly totalHypergraphEntities: number;
  readonly totalHyperedges: number;
  readonly ontologicalAudit: HypergraphAuditReceipt;
}

export interface CausalDiagnosisReport {
  readonly topologicalOrder: readonly string[];
  readonly backdoorSet: readonly string[];
  readonly backdoorValid: boolean;
  readonly dSeparatedWhenConditionedOnConfounder: boolean;
  readonly interventionalAte: number;
  readonly expectedYieldAtLowClarity: number;
  readonly expectedYieldAtHighClarity: number;
  readonly factualFirstPassYield: number;
  readonly counterfactualFirstPassYield: number;
  readonly individualTreatmentEffect: number;
  readonly scmSelfAuditPassed: boolean;
}

export interface DeshPreFlightReport {
  readonly seed: string;
  readonly checkpointId: string;
  readonly injectedFaultCount: number;
  readonly rollbackSucceeded: boolean;
  readonly virtualTimeAfterReplayNs: number;
  readonly deshAudit: DeshAuditReceipt;
}

export interface GitCommitTelemetrySample {
  readonly sha: string;
  readonly subject: string;
  readonly category: "SDD_SPEC" | "BUGFIX_REWORK" | "DOCS_SYNC";
}

export interface LiveGitHarnessReport {
  readonly gitAvailable: boolean;
  readonly commitsSampled: number;
  readonly cohortTelemetry: CohortTelemetrySummary;
  readonly harnessLoopResult: HarnessExecutionResult;
  readonly sampleCommits: readonly GitCommitTelemetrySample[];
}

export interface ClosedLoopAutopilotAuditReceipt {
  readonly specRef: "SPEC-340";
  readonly projectRoot: string;
  readonly stageOrder: readonly AutopilotStageName[];
  readonly stageOrderPreserved: boolean;
  readonly ontologyVerified: boolean;
  readonly causalVerified: boolean;
  readonly simulationVerified: boolean;
  readonly harnessVerified: boolean;
  readonly allPassed: boolean;
  readonly ingestion: RepositoryIngestionReport;
  readonly causal: CausalDiagnosisReport;
  readonly simulation: DeshPreFlightReport;
  readonly harness: LiveGitHarnessReport;
  readonly sha256Digest: string;
}
