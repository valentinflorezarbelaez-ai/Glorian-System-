/**
 * EOS SYSTEM — PHASE-1 CORE UTILITARIAN MCP HANDLERS (SPEC-155)
 * Extracted from eosMcpServer.ts with semantic parity for conscious core tools.
 */

import { amplifyPrompt, type ModelFamily, type StrictnessLevel } from "../../core/eosPromptAmplifier.ts";
import { scanArchitecture } from "../../core/eosArchitectureGuard.ts";
import { evaluateDecision } from "../../core/eosCognitiveJudge.ts";
import { runTurboPipeline } from "../../core/eosTurboEngine.ts";
import { EosNocturnalEvolutionEngine } from "../../core/eosNocturnalEvolutionEngine.ts";
import { EosGentlemanStackBridge } from "../../core/eosGentlemanStackBridge.ts";
import { EosFleetSoundcheckMesh } from "../../core/eosFleetSoundcheckMesh.ts";
import { EosTypeScriptAstAnalyzer } from "../../core/eosTypeScriptAstAnalyzer.ts";
import { EosEnterpriseWorkspaceGovernor } from "../../core/eosEnterpriseWorkspaceGovernor.ts";
import {
  runMissionGoldenPath,
  type MissionDomainHint
} from "../../core/eosMissionGoldenPathOrchestrator.ts";
import { EosDurableSqliteLedger } from "../../core/eosDurableSqliteLedger.ts";
import { runControlPlaneHealthProbes } from "../../core/eosControlPlaneHealthProbes.ts";
import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";

export const PHASE1_CORE_UTILITARIAN_HANDLERS: Readonly<Record<string, McpToolHandler>> = {
  eos_mission_run: (args, ctx) => {
    const directive = String(args.directive || args.rawPrompt || "");
    const domainHint = args.domainHint
      ? (String(args.domainHint) as MissionDomainHint)
      : undefined;
    ctx.onProgress?.(10, 100, "Mission Golden Path: amplify → gates → turbo");
    const result = runMissionGoldenPath(directive, {
      projectRoot: ctx.projectRoot,
      target: args.target ? String(args.target) : "eos-system",
      domainHint,
      architectureTargetDir: args.architectureTargetDir
        ? String(args.architectureTargetDir)
        : "src/core",
      sealLedger: args.sealLedger !== false,
      ledgerPath:
        args.persistLedger === true
          ? EosDurableSqliteLedger.defaultLedgerPath(ctx.projectRoot)
          : ":memory:"
    });
    ctx.onProgress?.(100, 100, `Mission ${result.status}`);
    return result;
  },

  eos_health_check: (_args, ctx) => {
    const report = runControlPlaneHealthProbes(ctx.projectRoot);
    return {
      ...report,
      scope:
        "Local control-plane probes only (SBOM, provenance, Layer-0 deps, registry, tip-seal pin). No network / multi-region SRE.",
      subsystemProbes: "RUN"
    };
  },

  eos_amplify_prompt: (args) => {
    const rawPrompt = String(args.rawPrompt || "");
    const targetModel = (args.targetModel || "universal") as ModelFamily;
    const strictLevel = (args.strictLevel || "hardened") as StrictnessLevel;
    return amplifyPrompt({ rawPrompt, targetModel, strictLevel });
  },

  eos_check_architecture: (args, ctx) => {
    const targetDir = ctx.resolveProjectPath(args.targetDir, "directory", "src");
    return scanArchitecture(targetDir, ctx.projectRoot);
  },

  eos_evaluate_decision: (args) =>
    evaluateDecision({
      title: String(args.title || "Architectural Evaluation"),
      description: String(args.description || ""),
      proposedAction: String(args.proposedAction || ""),
      codeSnippet: args.codeSnippet ? String(args.codeSnippet) : undefined,
      targetDomain: args.targetDomain ? String(args.targetDomain) : undefined
    }),

  eos_turbo_verify: (_args, ctx) => runTurboPipeline(ctx.projectRoot),

  eos_nocturnal_evolution: (args, ctx) => {
    const engine = new EosNocturnalEvolutionEngine(ctx.projectRoot);
    const targetDir = args?.targetDir ? String(args.targetDir) : "src/core";
    const format = String(args?.format || "json").toLowerCase();
    const report = engine.runEvolutionSweep({ targetDir });
    if (format === "summary") {
      return {
        summary: EosNocturnalEvolutionEngine.formatNocturnalSummary(report),
        compositeFitnessScore: report.compositeFitnessScore,
        sha256Receipt: report.sha256Receipt,
        timestampIso: report.timestampIso
      };
    }
    return report;
  },

  eos_gentleman_audit: (args, ctx) => {
    const geminiDir =
      typeof args.geminiConfigDir === "string" && args.geminiConfigDir.trim().length > 0
        ? args.geminiConfigDir.trim()
        : undefined;
    return EosGentlemanStackBridge.auditStack(ctx.projectRoot, geminiDir);
  },

  eos_fleet_soundcheck: (args, ctx) => {
    const safeRoot = ctx.resolveProjectPath(args?.projectRoot, "directory", ".");
    return EosFleetSoundcheckMesh.auditFleet(safeRoot);
  },

  eos_ast_analyze: (args, ctx) => {
    if (
      typeof args?.projectId === "string" &&
      args.projectId.trim().length > 0 &&
      args.projectId.trim().toLowerCase() !== "eos-system"
    ) {
      const resolved = EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace(
        args.projectId.trim(),
        typeof args?.targetDir === "string" && args.targetDir.trim().length > 0
          ? args.targetDir.trim()
          : ".",
        "READ_ONLY",
        ctx.projectRoot
      );
      return EosTypeScriptAstAnalyzer.analyzeDirectory(
        resolved.resolvedTargetPath,
        resolved.workspaceRoot
      );
    }
    const safeDir = ctx.resolveProjectPath(args?.targetDir, "directory", "src/core");
    return EosTypeScriptAstAnalyzer.analyzeDirectory(safeDir, ctx.projectRoot);
  }
};

export { PHASE1_MIGRATED_TOOL_NAMES } from "../../core/eosMcpToolTaxonomy.ts";
