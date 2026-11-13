/**
 * SPEC-234 / CHANGE-119 — Layer-0 Jarvis Autonomous SDLC Orchestrator Types.
 * Zero external runtime dependencies (EOS Law V).
 */

export type CompanyPresetId = "spotify" | "nubank" | "google" | "generic-enterprise";

export type SdlcExecutionTrack = "FAST_TRACK_TDD" | "HEAVY_TRACK_SDD";

export type JarvisMissionStatus =
  "PLANNING" | "AWAITING_IMPLEMENTATION" | "VALIDATING" | "HEALING" | "READY_FOR_APPROVAL" | "FAILED";

export type JarvisFailureCategory =
  | "UNIT_AND_INTEGRATION_TESTS_FAILED"
  | "BEYONCE_COVERAGE_BELOW_THRESHOLD"
  | "HEXAGONAL_BOUNDARY_VIOLATION"
  | "PLAIN_SECRET_EXPOSURE"
  | "LAYER0_RUNTIME_DEPENDENCY_VIOLATION"
  | "STATIC_LINT_OR_TYPE_VIOLATION";

export interface AssimilateCompanyDnaOptions {
  readonly preset?: CompanyPresetId;
  readonly companyName?: string;
  readonly squadOwner?: string;
  readonly tribe?: string;
  readonly repoPath?: string;
  readonly projectRoot?: string;
}

export interface CompanyDnaProfile {
  readonly preset: CompanyPresetId;
  readonly companyName: string;
  readonly squadOwner: string;
  readonly tribe: string;
  readonly gitStrategy: string;
  readonly maxBranchLifetimeHours: number;
  readonly featureFlagStrategy: string;
  readonly testingModel: string;
  readonly minCoveragePercent: number;
  readonly supportedStacks: readonly string[];
  readonly detectedRepoSignals: readonly string[];
  readonly hexagonalLayerRules: readonly string[];
  readonly backstageEnabled: boolean;
  readonly dnaDigestSha256: string;
}

export interface JarvisSdlcDirective {
  readonly ticketId: string;
  readonly ticketTitle: string;
  readonly ticketDescription: string;
  readonly companyPreset?: CompanyPresetId;
  readonly squadOwner?: string;
  readonly tribe?: string;
  readonly track?: SdlcExecutionTrack;
  readonly featureFlagKey?: string;
  readonly targetStack?: string;
  readonly maxHealAttempts?: number;
}

export interface FeatureFlagGuardContract {
  readonly flagKey: string;
  readonly strategy: string;
  readonly defaultEnabled: false;
  readonly rolloutStage: "CANARY_1_PERCENT" | "DARK_LAUNCH_0_PERCENT";
}

export interface JarvisValidationInput {
  readonly testsPassed: number;
  readonly totalTests: number;
  readonly coveragePercent: number;
  readonly domainImportsInfrastructure: boolean;
  readonly plainSecretsCount: number;
  readonly runtimeDependenciesCount: number;
  readonly lintErrorsCount: number;
  readonly errorLog?: string;
}

export interface JarvisHealDiagnosis {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly failureCategories: readonly JarvisFailureCategory[];
  readonly rootCauseSummary: string;
  readonly surgicalRemediationSteps: readonly string[];
  readonly canRetry: boolean;
}

export interface SoundcheckEvaluation {
  readonly passed: boolean;
  readonly score: number;
  readonly hexagonalIsolationVerified: boolean;
  readonly zeroPlainSecretsVerified: boolean;
  readonly slsaLayer0Verified: boolean;
  readonly beyonceCoverageVerified: boolean;
  readonly backstageCatalogYaml: string;
  readonly attestationDigestSha256: string;
}

export interface JarvisMissionState {
  readonly missionId: string;
  readonly workflowId: string;
  readonly status: JarvisMissionStatus;
  readonly directive: JarvisSdlcDirective;
  readonly companyDna: CompanyDnaProfile;
  readonly track: SdlcExecutionTrack;
  readonly branchName: string;
  readonly worktreePath: string;
  readonly featureFlagGuard: FeatureFlagGuardContract;
  readonly earsRequirements: readonly string[];
  readonly bddScenarios: readonly string[];
  readonly impactedLayers: readonly string[];
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly lastDiagnosis?: JarvisHealDiagnosis;
  readonly soundcheck?: SoundcheckEvaluation;
  readonly approvalDiffSha256?: string;
  readonly executiveSummaryBullets: readonly string[];
  readonly prMarkdownDraft: string;
  readonly receiptSha256: string;
}

export interface CompileAutopilotRulesOptions {
  readonly projectRoot?: string;
  readonly outputRelPath?: string;
  readonly companyPreset?: CompanyPresetId;
  readonly squadOwner?: string;
  readonly tribe?: string;
  readonly writeToDisk?: boolean;
}

export interface IdeAutopilotRulesPackage {
  readonly canonicalRulePath: string;
  readonly markdownContent: string;
  readonly targetIdeBindings: readonly string[];
  readonly writtenToDisk: boolean;
  readonly rulesDigestSha256: string;
}
