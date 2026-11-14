/**
 * SPEC-238 / CHANGE-121 — Layer-0 Live Git Diff PR Inspector Types.
 * Zero external runtime dependencies (EOS Law V).
 */

import type { DiffAndMigrationAuditReport, DiffFileEntry } from "./eosIssueToPrCanaryBridgeCore.types.ts";

export interface InspectLiveGitDiffOptions {
  readonly projectRoot?: string;
  readonly repoPath?: string;
  readonly baseRef?: string;
  readonly ticketId?: string;
  readonly title?: string;
  readonly numstatOverride?: string;
  readonly patchOverride?: string;
  readonly writeBundle?: boolean;
  readonly bundleRelPath?: string;
}

export interface LiveGitDiffInspectionReport {
  readonly ticketId: string;
  readonly baseRef: string;
  readonly changedFiles: readonly DiffFileEntry[];
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly secretMatchesCount: number;
  readonly diffAudit: DiffAndMigrationAuditReport;
  readonly prBundleMarkdown: string;
  readonly writtenBundlePath?: string;
  readonly readyToShip: boolean;
  readonly inspectionDigestSha256: string;
}
