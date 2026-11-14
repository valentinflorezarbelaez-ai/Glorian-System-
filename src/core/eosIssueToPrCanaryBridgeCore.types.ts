/**
 * SPEC-236 / CHANGE-120 — Layer-0 Issue-to-PR Bridge, Diff Blast-Radius & Canary Rollback Types.
 * Zero external runtime dependencies (EOS Law V).
 */

import type { CompanyPresetId, SdlcExecutionTrack } from "./eosJarvisSdlcOrchestratorCore.types.ts";

export type IssueSourceSystem = "jira" | "linear" | "github" | "manual";

export type IssuePriorityLevel = "P0" | "P1" | "P2" | "P3";

export type MigrationSafetyPattern = "NONE" | "SAFE_EXPAND_AND_CONTRACT" | "UNSAFE_BREAKING_DDL";

export interface RawIssuePayloadInput {
  readonly ticketId?: string;
  readonly key?: string;
  readonly identifier?: string;
  readonly number?: number;
  readonly sourceSystem?: IssueSourceSystem;
  readonly title?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly body?: string;
  readonly priority?: string;
  readonly labels?: readonly string[];
  readonly components?: readonly string[];
  readonly acceptanceCriteria?: readonly string[];
}

export interface CanonicalIssueDescriptor {
  readonly ticketId: string;
  readonly sourceSystem: IssueSourceSystem;
  readonly title: string;
  readonly description: string;
  readonly acceptanceCriteria: readonly string[];
  readonly priority: IssuePriorityLevel;
  readonly slaHours: number;
  readonly affectedComponents: readonly string[];
  readonly suggestedTrack: SdlcExecutionTrack;
  readonly issueDigestSha256: string;
}

export interface DiffFileEntry {
  readonly path: string;
  readonly additions?: number;
  readonly deletions?: number;
}

export interface AnalyzeDiffAndMigrationInput {
  readonly changedFiles: readonly DiffFileEntry[];
  readonly sqlMigrationSnippet?: string;
}

export interface DiffAndMigrationAuditReport {
  readonly touchedLayers: readonly string[];
  readonly beyonceRuleSatisfied: boolean;
  readonly migrationPattern: MigrationSafetyPattern;
  readonly unsafeDdlStatements: readonly string[];
  readonly blastRadiusScore: number;
  readonly blockingRisks: readonly string[];
  readonly diffDigestSha256: string;
}

export interface CompileCanaryPlanInput {
  readonly ticketId: string;
  readonly featureFlagKey: string;
  readonly workflowId: string;
  readonly approvalDiffSha256: string;
  readonly companyPreset?: CompanyPresetId;
  readonly maxErrorRateDeltaPercent?: number;
  readonly maxLatencyP99Ms?: number;
}

export interface CanaryStageDescriptor {
  readonly stageName: string;
  readonly trafficPercent: number;
  readonly soakMinutes: number;
  readonly autoRollbackCondition: string;
}

export interface CanaryRolloutAndRollbackPlan {
  readonly ticketId: string;
  readonly featureFlagKey: string;
  readonly stages: readonly CanaryStageDescriptor[];
  readonly sloGuardrails: {
    readonly maxErrorRateDeltaPercent: number;
    readonly maxLatencyP99Ms: number;
  };
  readonly killSwitchCommands: {
    readonly disableFeatureFlagCmd: string;
    readonly gitRevertBranchCmd: string;
    readonly worktreeCleanupCmd: string;
  };
  readonly blamelessPostmortemTemplate: string;
  readonly planDigestSha256: string;
}
