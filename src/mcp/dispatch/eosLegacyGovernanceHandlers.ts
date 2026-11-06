/**
 * Legacy MCP dispatch handlers: design system, formal assurance and governance.
 * SPEC-155: tools already served by EosMcpDispatchRegistry must not be duplicated here.
 */
import type { EosLegacyToolHandler } from "./eosLegacyDispatchContext.ts";
import { globalDesignStudio, globalPlanetaryGovernor } from "./eosLegacyDispatchState.ts";
import { EosTlcFormalChecker } from "../../core/eosTlcFormalChecker.ts";
import { EosTelemetryDashboard } from "../../core/eosTelemetryDashboard.ts";
import { EosConsciousWitness } from "../../core/eosConsciousWitness.ts";
import { EosSapFixAutoshipper } from "../../core/eosSapFixAutoshipper.ts";
import { EosProductionChaosMonkey } from "../../core/eosProductionChaosMonkey.ts";
import { type DesignArchetype, type DesignComponentType } from "../../core/eosEliteDesignStudioEngine.ts";
import { EosS0DesignSystemGovernor } from "../../core/eosS0DesignSystemGovernor.ts";

const handlers: Record<string, EosLegacyToolHandler> = {
  "eos_design_scaffold_component": (ctx, args, onProgress) => {
    const archetype = String(args.archetype || "SPOTIFY_XIRP").toUpperCase() as DesignArchetype;
    const componentType = String(args.componentType || "INCIDENT_TIMELINE").toUpperCase() as DesignComponentType;
    const title = args.title ? String(args.title) : undefined;
    const subtitle = args.subtitle ? String(args.subtitle) : undefined;
    return globalDesignStudio.scaffoldComponent(archetype, componentType, { title, subtitle });
  },

  "eos_design_audit_markup": (ctx, args, onProgress) => {
    const markup = String(args.markup || "");
    return globalDesignStudio.auditDesignMarkup(markup);
  },

  "eos_jpl_power_of_ten_audit": (ctx, args, onProgress) => {
    const sourceCode = String(args.sourceCode || "");
    return globalPlanetaryGovernor.auditJplPowerOfTen(sourceCode);
  },

  "eos_tmr_consensus_adjudicate": (ctx, args, onProgress) => {
    const votes = Array.isArray(args.votes) ? args.votes : [];
    return globalPlanetaryGovernor.adjudicateTmrConsensus(votes);
  },

  "eos_tlc_checker": (ctx, args, onProgress) => {
    const action = String(args?.action || "check").trim().toLowerCase();
    const specName = String(args?.specification || "TlcFormalModelChecker.tla").trim();
    const steps = typeof args?.steps === "number" ? Math.floor(args.steps) : 200;

    if (action === "detect" || action === "status") {
      return EosTlcFormalChecker.detectRuntime(ctx.projectRoot);
    }

    const result = EosTlcFormalChecker.verifyModel(specName, {
      projectRoot: ctx.projectRoot,
      steps
    });

    if (args?.recordToLedger === true) {
      EosTlcFormalChecker.recordReceiptInLedger(result, ctx.projectRoot);
    }

    return result;
  },

  "eos_dashboard_status": (ctx, args, onProgress) => {
    const action = String(args?.action || "snapshot").trim().toLowerCase();
    const port = typeof args?.port === "number" ? Math.floor(args.port) : 4321;
    const dashboard = new EosTelemetryDashboard(ctx.projectRoot, port);
    const snapshot = dashboard.getSnapshot();

    if (args?.recordToLedger === true) {
      dashboard.recordSnapshotInLedger(snapshot);
    }

    return {
      status: "NOMINAL",
      action,
      port,
      snapshot
    };
  },

  "eos_conscious_witness": (ctx, args, onProgress) => {
    const witness = new EosConsciousWitness(ctx.projectRoot);
    const declaredSpecId = args?.declaredSpecId ? String(args.declaredSpecId) : undefined;
    const targetFiles = Array.isArray(args?.targetFiles) ? args.targetFiles.map(String) : [];
    const proposedAction = String(args?.proposedAction || "Inspect and verify");
    const affirmedSymbols = Array.isArray(args?.affirmedSymbols) ? args.affirmedSymbols.map(String) : [];

    return witness.interrogateAgentIntention({
      targetFiles,
      proposedAction,
      declaredSpecId,
      affirmedSymbols
    });
  },

  "eos_sapfix_autoshipper": (ctx, args, onProgress) => {
    const faultId = String(args?.faultId || `FAULT-${Date.now().toString(36).toUpperCase()}`);
    const targetFilePath = args?.targetFilePath ? String(args.targetFilePath) : (args?.targetFile ? String(args.targetFile) : "src/core/eosKernelPrimitives.ts");
    const failingLine = typeof args?.failingLine === "number" ? args.failingLine : 10;
    const errorMessage = String(args?.errorMessage || "Regression detected during gate verification");
    const dryRun = args?.dryRun !== false;

    const report = EosSapFixAutoshipper.executeCycle({
      faultId,
      targetFilePath,
      failingLine,
      errorMessage
    }, ctx.projectRoot, { dryRun });

    EosSapFixAutoshipper.recordReceiptInLedger(report, ctx.projectRoot);
    return report;
  },

  "eos_chaos_monkey_live": (ctx, args, onProgress) => {
    const targetUrl = args?.targetUrl ? String(args.targetUrl) : "https://eos.dev/health";
    const burstCount = typeof args?.burstCount === "number" ? args.burstCount : 5;
    const maxErrorBudgetPercent = typeof args?.maxErrorBudgetPercent === "number" ? args.maxErrorBudgetPercent : 20;
    const recordToLedger = args?.recordToLedger !== false;

    const report = EosProductionChaosMonkey.executeExperimentSync(targetUrl, {
      burstCount,
      maxErrorBudgetPercent,
      mockTransport: (i) => ({
        status: i % 4 === 3 ? 500 : 200,
        latencyMs: 10 + (i * 5)
      })
    });

    if (recordToLedger) {
      EosProductionChaosMonkey.recordReceiptInLedger(report, ctx.projectRoot);
    }
    return report;
  },

  "eos_design_system_govern": (ctx, args, onProgress) => {
    const governor = new EosS0DesignSystemGovernor(ctx.projectRoot);
    const targetPaths = Array.isArray(args?.targetPaths)
      ? args.targetPaths.map(String)
      : undefined;
    const report = governor.auditWorkspace(targetPaths);
    return {
      compliant: report.compliant,
      inspectedFiles: report.inspectedFiles,
      violationCount: report.violations.length,
      warningCount: report.warnings.length,
      violations: report.violations,
      warnings: report.warnings,
      score: report.score,
      contractHash: report.contractHash,
      timestampIso: new Date().toISOString()
    };
  },
};

export const GOVERNANCE_LEGACY_HANDLERS: Readonly<Record<string, EosLegacyToolHandler>> = Object.freeze(handlers);
