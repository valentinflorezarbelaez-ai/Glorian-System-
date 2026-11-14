export interface ModuleLineCountInput {
  readonly filePath: string;
  readonly lineCount: number;
}

export interface CliCatalogHygieneAuditInput {
  readonly projectRoot?: string;
  readonly cliCommandsDirRelPath?: string;
  readonly helpCatalogRelPath?: string;
  readonly developerGuideRelPath?: string;
  readonly registeredCommands?: readonly string[];
  readonly helpCatalogText?: string;
  readonly developerGuideText?: string;
  readonly moduleLineCounts?: readonly ModuleLineCountInput[];
  readonly scanDirectories?: readonly string[];
  readonly hardLimitLines?: number;
  readonly minRequiredHeadroomLines?: number;
}

export type CliCatalogHygieneVerdict = "HYGIENE_GOVERNED" | "HYGIENE_WARNING" | "HYGIENE_BREACH";

export interface ModuleHeadroomRecord {
  readonly filePath: string;
  readonly lineCount: number;
  readonly headroomLines: number;
  readonly status: "HEALTHY" | "NEAR_CEILING_WARNING" | "CEILING_BREACH";
}

export interface CliCatalogHygieneAuditReport {
  readonly verdict: CliCatalogHygieneVerdict;
  readonly hardLimitLines: number;
  readonly minRequiredHeadroomLines: number;
  readonly totalCommandsRegistered: number;
  readonly catalogedCommandsCount: number;
  readonly catalogCoverageRatio: number;
  readonly missingFromHelpCatalog: readonly string[];
  readonly developerGuideDocumentedCount: number;
  readonly totalModulesScanned: number;
  readonly maxLinesObserved: number;
  readonly minHeadroomLines: number;
  readonly nearCeilingModules: readonly ModuleHeadroomRecord[];
  readonly breachedModules: readonly ModuleHeadroomRecord[];
  readonly topLargestModules: readonly ModuleHeadroomRecord[];
  readonly sha256Receipt: string;
}
