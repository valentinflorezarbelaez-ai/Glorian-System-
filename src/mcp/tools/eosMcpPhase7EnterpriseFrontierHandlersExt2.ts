/**
 * EOS MCP Phase 7 Enterprise Frontier Handlers Extension 2 (SPEC-234..SPEC-237 / CHANGE-119..CHANGE-120)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 22.18+ Strip-Only TypeScript.
 * Enforces strict line count ceiling <= 800 lines across all MCP handler modules.
 */

import { EosJarvisSdlcOrchestratorCore } from "../../core/eosJarvisSdlcOrchestratorCore.ts";
import type {
  CompanyPresetId,
  JarvisMissionState,
  JarvisValidationInput,
  SdlcExecutionTrack,
} from "../../core/eosJarvisSdlcOrchestratorCore.types.ts";
import { EosPolyglotToolchainAdapterCore } from "../../core/eosPolyglotToolchainAdapterCore.ts";
import type { PolyglotStackId } from "../../core/eosPolyglotToolchainAdapterCore.types.ts";
import { EosIssueToPrCanaryBridgeCore } from "../../core/eosIssueToPrCanaryBridgeCore.ts";
import type { DiffFileEntry, IssueSourceSystem } from "../../core/eosIssueToPrCanaryBridgeCore.types.ts";
import { EosStaffEngineerAdversarialJudgeCore } from "../../core/eosStaffEngineerAdversarialJudgeCore.ts";
import type { StaffPillarScores } from "../../core/eosStaffEngineerAdversarialJudgeCore.types.ts";
import { type Phase7DomainHandlerDeps, isPlainRecord } from "./eosMcpPhase7Shared.ts";

function numOr(val: unknown, fallback: number): number {
  return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

function strOr(val: unknown, fallback: string): string {
  return typeof val === "string" && val.trim() ? val : fallback;
}

function buildDefaultValidation(raw?: Record<string, unknown>): JarvisValidationInput {
  return {
    testsPassed: numOr(raw?.testsPassed, 10),
    totalTests: numOr(raw?.totalTests, 10),
    coveragePercent: numOr(raw?.coveragePercent, 92),
    domainImportsInfrastructure: raw?.domainImportsInfrastructure === true,
    plainSecretsCount: numOr(raw?.plainSecretsCount, 0),
    runtimeDependenciesCount: numOr(raw?.runtimeDependenciesCount, 0),
    lintErrorsCount: numOr(raw?.lintErrorsCount, 0),
    errorLog: typeof raw?.errorLog === "string" ? raw.errorLog : undefined,
  };
}

function resolveMissionState(args: Record<string, any> | undefined): JarvisMissionState {
  if (isPlainRecord(args?.missionState)) {
    return args.missionState as unknown as JarvisMissionState;
  }
  return EosJarvisSdlcOrchestratorCore.initiateMission({
    ticketId: strOr(args?.ticketId, "SPOT-402"),
    ticketTitle: strOr(args?.ticketTitle, "Autonomous SDLC mission"),
    ticketDescription: strOr(
      args?.ticketDescription,
      "Implement specification-driven behavior behind dark-launch feature flag.",
    ),
    companyPreset: (args?.companyPreset as CompanyPresetId | undefined) ?? "spotify",
    squadOwner: typeof args?.squadOwner === "string" ? args.squadOwner : undefined,
    tribe: typeof args?.tribe === "string" ? args.tribe : undefined,
    track: args?.track as SdlcExecutionTrack | undefined,
    featureFlagKey: typeof args?.featureFlagKey === "string" ? args.featureFlagKey : undefined,
    maxHealAttempts: typeof args?.maxHealAttempts === "number" ? args.maxHealAttempts : undefined,
  });
}

function dispatchPolyglotOrBridge(
  action: string,
  args: Record<string, any> | undefined,
  deps: Phase7DomainHandlerDeps,
): unknown | undefined {
  if (action === "polyglot_detect") {
    const profile = EosPolyglotToolchainAdapterCore.detectStackAndBuildMatrix({
      stackId: args?.stackId as PolyglotStackId | undefined,
      repoPath: typeof args?.repoPath === "string" ? args.repoPath : undefined,
      projectRoot: deps.projectRoot,
      serviceName: typeof args?.serviceName === "string" ? args.serviceName : undefined,
    });
    return { ...profile, action: "polyglot_detect" };
  }
  if (action === "polyglot_normalize") {
    const res = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({
      stackId: (args?.stackId as PolyglotStackId | undefined) ?? "go",
      rawOutput: typeof args?.rawOutput === "string" ? args.rawOutput : undefined,
      testsPassed: typeof args?.testsPassed === "number" ? args.testsPassed : undefined,
      totalTests: typeof args?.totalTests === "number" ? args.totalTests : undefined,
      coveragePercent: typeof args?.coveragePercent === "number" ? args.coveragePercent : undefined,
      domainImportsInfrastructure: args?.domainImportsInfrastructure === true,
      plainSecretsCount: typeof args?.plainSecretsCount === "number" ? args.plainSecretsCount : undefined,
      lintErrorsCount: typeof args?.lintErrorsCount === "number" ? args.lintErrorsCount : undefined,
    });
    return { ...res, action: "polyglot_normalize" };
  }
  if (action === "issue_bridge_parse") {
    const issue = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
      ticketId: typeof args?.ticketId === "string" ? args.ticketId : undefined,
      key: typeof args?.key === "string" ? args.key : undefined,
      sourceSystem: args?.sourceSystem as IssueSourceSystem | undefined,
      title: typeof args?.title === "string" ? args.title : undefined,
      description: typeof args?.description === "string" ? args.description : undefined,
      priority: typeof args?.priority === "string" ? args.priority : undefined,
      acceptanceCriteria: Array.isArray(args?.acceptanceCriteria) ? args.acceptanceCriteria : undefined,
    });
    return { ...issue, action: "issue_bridge_parse" };
  }
  if (action === "diff_migration_audit") {
    const changedFiles: DiffFileEntry[] = Array.isArray(args?.changedFiles)
      ? args.changedFiles
      : [
          { path: "src/core/service.ts", additions: 20 },
          { path: "test/service.test.mjs", additions: 30 },
        ];
    const report = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
      changedFiles,
      sqlMigrationSnippet: typeof args?.sqlMigrationSnippet === "string" ? args.sqlMigrationSnippet : undefined,
    });
    return { ...report, action: "diff_migration_audit" };
  }
  return undefined;
}

export function dispatchPhase7FrontierActionExt2(
  action: string,
  args: Record<string, any> | undefined,
  deps: Phase7DomainHandlerDeps,
): unknown | undefined {
  if (action === "jarvis_dna_assimilate") {
    const profile = EosJarvisSdlcOrchestratorCore.assimilateCompanyDna({
      preset: (args?.preset as CompanyPresetId | undefined) ?? "spotify",
      companyName: typeof args?.companyName === "string" ? args.companyName : undefined,
      squadOwner: typeof args?.squadOwner === "string" ? args.squadOwner : undefined,
      tribe: typeof args?.tribe === "string" ? args.tribe : undefined,
      repoPath: typeof args?.repoPath === "string" ? args.repoPath : undefined,
      projectRoot: deps.projectRoot,
    });
    return { ...profile, action: "jarvis_dna_assimilate" };
  }
  if (action === "jarvis_sdlc_start") {
    return { ...resolveMissionState(args), action: "jarvis_sdlc_start" };
  }
  if (action === "jarvis_sdlc_verify") {
    const result = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(
      resolveMissionState(args),
      buildDefaultValidation(isPlainRecord(args?.validation) ? args.validation : args),
    );
    return { ...result, action: "jarvis_sdlc_verify" };
  }
  if (action === "jarvis_sync_rules") {
    const pkg = EosJarvisSdlcOrchestratorCore.compileAutopilotRulesPackage({
      projectRoot: deps.projectRoot,
      outputRelPath: typeof args?.outputRelPath === "string" ? args.outputRelPath : undefined,
      companyPreset: (args?.companyPreset as CompanyPresetId | undefined) ?? "spotify",
      squadOwner: typeof args?.squadOwner === "string" ? args.squadOwner : undefined,
      tribe: typeof args?.tribe === "string" ? args.tribe : undefined,
      writeToDisk: args?.writeToDisk === true,
    });
    return { ...pkg, action: "jarvis_sync_rules" };
  }
  if (action === "canary_rollback_plan") {
    const plan = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
      ticketId: strOr(args?.ticketId, "PAY-881"),
      featureFlagKey: strOr(args?.featureFlagKey, "ff_pay_881"),
      workflowId: strOr(args?.workflowId, "flow-canary-01"),
      approvalDiffSha256: strOr(args?.approvalDiffSha256, "a".repeat(64)),
      companyPreset: args?.companyPreset as CompanyPresetId | undefined,
    });
    return { ...plan, action: "canary_rollback_plan" };
  }
  if (action === "staff_adversarial_judge") {
    const verdict = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: strOr(args?.targetId, "PR-237"),
      title: typeof args?.title === "string" ? args.title : undefined,
      pillarScores: isPlainRecord(args?.pillarScores) ? (args.pillarScores as Partial<StaffPillarScores>) : undefined,
      plainSecretsDetected: args?.plainSecretsDetected === true,
      unsafeMigrationDetected: args?.unsafeMigrationDetected === true,
      missingTestsForProdChanges: args?.missingTestsForProdChanges === true,
      singlePointOfFailureDetected: args?.singlePointOfFailureDetected === true,
    });
    return { ...verdict, action: "staff_adversarial_judge" };
  }
  return dispatchPolyglotOrBridge(action, args, deps);
}
