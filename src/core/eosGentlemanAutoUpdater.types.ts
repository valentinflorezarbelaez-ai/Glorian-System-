/**
 * Type contracts for EosGentlemanAutoUpdater (SPEC-045).
 * Extracted into standalone types module per SPEC-250 / CHANGE-126 structural headroom discipline.
 */

export type ComponentUpdateStatus =
  "UP_TO_DATE" | "UPDATE_AVAILABLE" | "UPDATED" | "ROLLED_BACK" | "SKIPPED_OFFLINE" | "ERROR";

export interface GentlemanComponentCheck {
  readonly componentId: "gentle-ai" | "engram" | "gga" | "agent-teams-lite";
  readonly repositoryUrl: string;
  readonly installedVersion: string;
  readonly latestVersion: string;
  readonly latestCommitSha: string;
  readonly updateAvailable: boolean;
  readonly status: ComponentUpdateStatus;
  readonly detail: string;
}

export interface PersistedAutoUpdateState {
  readonly lastCheckedAtIso: string;
  readonly lastCheckedAtMs: number;
  readonly lastAppliedAtIso: string | null;
  readonly checkIntervalHours: number;
  readonly agentTeamsLiteCommitSha: string | null;
  readonly components: Readonly<Record<string, { version: string; updatedAtIso: string }>>;
  readonly lastReceiptSha256: string;
}

export interface GentlemanUpdateCycleReport {
  readonly mode: "CHECK_ONLY" | "APPLY";
  readonly executedAtIso: string;
  readonly lockSkipped: boolean;
  readonly constitutionPreserved: boolean;
  readonly constitutionSha256: string;
  readonly updatesDetected: number;
  readonly updatesApplied: number;
  readonly rollbacksTriggered: number;
  readonly components: readonly GentlemanComponentCheck[];
  readonly stateFilePath: string;
  readonly ledgerEntryId: string | null;
  readonly sha256Receipt: string;
}
