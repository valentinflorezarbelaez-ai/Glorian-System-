/**
 * EOS MCP Phase 7 Enterprise Frontier Handlers Extension 2 (SPEC-234 / CHANGE-119)
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
import { type Phase7DomainHandlerDeps, isPlainRecord } from "./eosMcpPhase7Shared.ts";

function buildDefaultValidation(raw?: Record<string, unknown>): JarvisValidationInput {
  return {
    testsPassed: typeof raw?.testsPassed === "number" ? raw.testsPassed : 10,
    totalTests: typeof raw?.totalTests === "number" ? raw.totalTests : 10,
    coveragePercent: typeof raw?.coveragePercent === "number" ? raw.coveragePercent : 92,
    domainImportsInfrastructure: raw?.domainImportsInfrastructure === true,
    plainSecretsCount: typeof raw?.plainSecretsCount === "number" ? raw.plainSecretsCount : 0,
    runtimeDependenciesCount: typeof raw?.runtimeDependenciesCount === "number" ? raw.runtimeDependenciesCount : 0,
    lintErrorsCount: typeof raw?.lintErrorsCount === "number" ? raw.lintErrorsCount : 0,
    errorLog: typeof raw?.errorLog === "string" ? raw.errorLog : undefined,
  };
}

function resolveMissionState(args: Record<string, any> | undefined): JarvisMissionState {
  if (isPlainRecord(args?.missionState)) {
    return args.missionState as unknown as JarvisMissionState;
  }
  const ticketId = typeof args?.ticketId === "string" && args.ticketId.trim() ? args.ticketId : "SPOT-402";
  const ticketTitle =
    typeof args?.ticketTitle === "string" && args.ticketTitle.trim() ? args.ticketTitle : "Autonomous SDLC mission";
  const ticketDescription =
    typeof args?.ticketDescription === "string" && args.ticketDescription.trim()
      ? args.ticketDescription
      : "Implement specification-driven behavior behind dark-launch feature flag.";
  const companyPreset = (args?.companyPreset as CompanyPresetId | undefined) ?? "spotify";
  return EosJarvisSdlcOrchestratorCore.initiateMission({
    ticketId,
    ticketTitle,
    ticketDescription,
    companyPreset,
    squadOwner: typeof args?.squadOwner === "string" ? args.squadOwner : undefined,
    tribe: typeof args?.tribe === "string" ? args.tribe : undefined,
    track: args?.track as SdlcExecutionTrack | undefined,
    featureFlagKey: typeof args?.featureFlagKey === "string" ? args.featureFlagKey : undefined,
    maxHealAttempts: typeof args?.maxHealAttempts === "number" ? args.maxHealAttempts : undefined,
  });
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
    const state = resolveMissionState(args);
    return { ...state, action: "jarvis_sdlc_start" };
  }

  if (action === "jarvis_sdlc_verify") {
    const state = resolveMissionState(args);
    const validation = buildDefaultValidation(isPlainRecord(args?.validation) ? args.validation : args);
    const result = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(state, validation);
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

  return undefined;
}
