/**
 * EOS ENTERPRISE WORKSPACE GOVERNOR — Type Definitions
 * Governed by SPEC-046, ADR-052 (v52.0.0)
 *
 * All public types, interfaces, and enums for the workspace topology engine.
 * Extracted from eosEnterpriseWorkspaceGovernor.ts for module cohesion.
 */

export type WorkspaceOrchestrator =
  | "turborepo"
  | "nx"
  | "pnpm_workspaces"
  | "npm_workspaces"
  | "cargo_workspace"
  | "go_workspace"
  | "python_uv_poetry"
  | "bazel"
  | "gradle_multi"
  | "melos_flutter"
  | "single_package";

export type EnterpriseLanguage =
  | "typescript"
  | "javascript"
  | "go"
  | "rust"
  | "python"
  | "flutter_dart"
  | "java_kotlin"
  | "cpp_c"
  | "csharp"
  | "sql"
  | "tla_plus";

export type WorkspaceArchitecturalRole =
  | "CONTROL_PLANE_OR_CORE"
  | "BACKEND_OR_SERVICE"
  | "FRONTEND_OR_CLIENT"
  | "SHARED_LIBRARY"
  | "INFRASTRUCTURE_OR_TOOLING";

export type ContractStandard =
  | "openapi"
  | "protobuf"
  | "graphql"
  | "asyncapi"
  | "json_schema"
  | "prisma"
  | "sql_migration"
  | "tla_plus";

export type WorkspaceAccessMode = "READ_ONLY" | "WRITE_GATED";

export interface WorkspaceMember {
  readonly name: string;
  readonly relativeDir: string;
  readonly manifestPath: string;
  readonly language: EnterpriseLanguage;
  readonly architecturalRole: WorkspaceArchitecturalRole;
}

export interface ContractArtifact {
  readonly standard: ContractStandard;
  readonly relativePath: string;
  readonly byteSize: number;
  readonly validSyntax: boolean;
  readonly detail: string;
}

export interface SecretFinding {
  readonly patternName: string;
  readonly relativePath: string;
}

export interface SupplyChainPosture {
  readonly lockfiles: readonly string[];
  readonly hasDeterministicLockfile: boolean;
  readonly containerManifests: readonly string[];
  readonly iacManifests: readonly string[];
  readonly ciWorkflows: readonly string[];
  readonly secretHygieneClean: boolean;
  readonly secretFindings: readonly SecretFinding[];
}

export interface EnterpriseVerificationCommand {
  readonly id: string;
  readonly stack: string;
  readonly command: string;
  readonly rationale: string;
}

export interface EnterpriseWorkspaceTopology {
  readonly workspaceName: string;
  readonly workspaceRoot: string;
  readonly archetype: "POLYGLOT_MONOREPO" | "SINGLE_LANGUAGE_MONOREPO" | "ENTERPRISE_SERVICE" | "MINIMAL_REPOSITORY";
  readonly orchestrators: readonly WorkspaceOrchestrator[];
  readonly languages: readonly EnterpriseLanguage[];
  readonly members: readonly WorkspaceMember[];
  readonly contracts: readonly ContractArtifact[];
  readonly supplyChain: SupplyChainPosture;
  readonly recommendedVerificationCommands: readonly EnterpriseVerificationCommand[];
  readonly scannedFileCount: number;
  readonly skippedSymlinkCount: number;
  readonly enterpriseReadinessSignalsScore: number;
  readonly scoreDisclaimer: string;
  readonly sha256TopologyReceipt: string;
  readonly timestamp: string;
}

export interface InspectWorkspaceOptions {
  readonly maxDepth?: number;
  readonly maxFiles?: number;
}

export interface RegisteredFleetWorkspace {
  readonly id: string;
  readonly name: string;
  readonly localPathEnv?: string;
  readonly localPath?: string;
  readonly resolvedLocalPath: string | null;
  readonly pathExistsOnDisk: boolean;
  readonly remoteUrl: string;
  readonly productionUrl?: string;
  readonly type: string;
  readonly status: string;
  readonly intake: string;
  readonly specification: string;
  readonly audit: string;
  readonly ownerApproval?: string;
  readonly authorization: string;
  readonly writeAuthorizedUnderLawIV: boolean;
  readonly missingLawIVPreconditions: readonly string[];
}

export interface OnboardWorkspaceInput {
  readonly targetPath: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly localPathEnv?: string;
  readonly remoteUrl?: string;
  readonly productionUrl?: string;
  readonly projectType?: string;
  readonly controlPlaneRoot?: string;
  readonly dryRun?: boolean;
  readonly ledgerDbPath?: string;
}

export interface OnboardGeneratedArtifact {
  readonly relativeControlPlanePath: string;
  readonly byteLength: number;
  readonly sha256Digest: string;
}

export interface OnboardWorkspaceResult {
  readonly projectId: string;
  readonly projectName: string;
  readonly externalTargetPath: string;
  readonly controlPlaneRoot: string;
  readonly dryRun: boolean;
  readonly initialAuthorization: "LEVEL_1_READ_ONLY_AUDIT";
  readonly externalBytesWritten: 0;
  readonly topology: EnterpriseWorkspaceTopology;
  readonly generatedArtifacts: readonly OnboardGeneratedArtifact[];
  readonly registryUpdated: boolean;
  readonly ledgerEntryId: string | null;
  readonly sha256OnboardReceipt: string;
}

export interface AuthorizedWorkspaceResolution {
  readonly projectId: string;
  readonly accessMode: WorkspaceAccessMode;
  readonly workspaceRoot: string;
  readonly resolvedTargetPath: string;
  readonly authorizationLevel: string;
  readonly writeBarrierStatus: "AUTHORIZED" | "READ_ONLY_CONFINED";
}

export interface StructuralGateResult {
  readonly gateId: string;
  readonly label: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface EnterpriseWorkspaceVerificationReport {
  readonly workspaceName: string;
  readonly workspaceRoot: string;
  readonly epistemicState: "VERIFIED" | "FINDINGS_IDENTIFIED";
  readonly overallPassed: boolean;
  readonly gates: readonly StructuralGateResult[];
  readonly recommendedCommands: readonly EnterpriseVerificationCommand[];
  readonly ledgerEntryId: string | null;
  readonly sha256VerificationReceipt: string;
  readonly timestamp: string;
}
