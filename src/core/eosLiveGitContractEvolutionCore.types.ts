/**
 * SPEC-244 / CHANGE-123 — Layer-0 Live Git Contract Evolution Core Types.
 */

import type { ApiContractDiffReport, SemverBumpLevel } from "./eosApiContractSemanticDiffCore.types.ts";

export interface ContractFilePairOverride {
  readonly filePath: string;
  readonly baselineSource: string;
  readonly candidateSource: string;
}

export interface AuditLiveGitContractsOptions {
  readonly projectRoot?: string;
  readonly repoPath?: string;
  readonly baseRef?: string;
  readonly filePairsOverride?: readonly ContractFilePairOverride[];
}

export interface LiveGitContractEvolutionReport {
  readonly baseRef: string;
  readonly filesAuditedCount: number;
  readonly totalBreakingChanges: number;
  readonly totalAdditiveChanges: number;
  readonly backwardCompatible: boolean;
  readonly overallSemverBump: SemverBumpLevel;
  readonly fileReports: readonly ApiContractDiffReport[];
  readonly expandAndContractAdvice: readonly string[];
  readonly evolutionDigestSha256: string;
}
