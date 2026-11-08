/**
 * EOS SYSTEM — PHASE-8 AGI / FORGE MCP HANDLERS (merge parity with main v64–v66)
 * Consulting deliverables, Tree-of-Thought solving, dynamic tool forging,
 * context-window assembly and spec-drift detection.
 */

import { EosAgiCore } from "../../core/eosAgiCore.ts";
import { EosConsultantCore } from "../../core/eosConsultantCore.ts";
import { EosContextWindowManager } from "../../core/eosContextWindowManager.ts";
import { EosDynamicToolForge } from "../../core/eosDynamicToolForge.ts";
import { EosPipeline } from "../../core/eosPipeline.ts";
import { EosSpecDriftDetector } from "../../core/eosSpecDriftDetector.ts";
import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";
import { PHASE8_MIGRATED_TOOL_NAMES } from "./eosMcpPhase8ToolNames.ts";

export { PHASE8_MIGRATED_TOOL_NAMES };

export interface Phase8AgiHandlerDeps {
  readonly projectRoot: string;
}

export function createPhase8AgiHandlers(deps: Phase8AgiHandlerDeps): Readonly<Record<string, McpToolHandler>> {
  const { projectRoot } = deps;

  return {
    eos_consult: (args) => {
      const consultant = new EosConsultantCore(projectRoot);
      const problem = String(args.problem || "");
      if (!problem) return { error: "problem field is required" };
      const deliverable = consultant.engage({
        problem,
        engagementType: args.engagementType as any,
        techStack: args.techStack as any,
        context: args.context ? String(args.context) : undefined,
        constraints: args.constraints ? String(args.constraints) : undefined,
      });
      const filePath = consultant.saveDeliverable(deliverable);
      return { ...deliverable, savedTo: filePath };
    },

    eos_agi_solve: (args, ctx) => {
      const core = new EosAgiCore(projectRoot);
      const branches = Array.isArray(args.branches) ? args.branches : [];
      const objective = String(args.objective || "");
      const testCommand = String(args.testCommand || "node scripts/verify-cicd-pipeline.mjs");

      const progressEvents: unknown[] = [];
      const result = core.solve(objective, branches, {
        testCommand,
        testCwd: projectRoot,
        timeoutMs: Number(args.timeoutMs) || 60_000,
        onProgress: (event) => {
          progressEvents.push(event);
          ctx.onProgress?.(progressEvents.length, branches.length, event.message);
        },
      });
      return result.then((solved) => ({ ...solved, progressEvents }));
    },

    eos_agi_axioms: () => {
      const core = new EosAgiCore(projectRoot);
      const axioms = core.getAxioms();
      return {
        axioms,
        rulesBlock: core.getRulesBlock(),
        totalAxioms: axioms.length,
      };
    },

    eos_forge_list: () => {
      const forge = new EosDynamicToolForge(projectRoot);
      return {
        tools: forge.listTools(),
        mcpDescriptors: forge.getMcpToolDescriptors(),
        forgeDirectory: forge.forgeDirectory,
      };
    },

    eos_forge_tool: (args) => {
      const forge = new EosDynamicToolForge(projectRoot);
      const result = forge.forge({
        toolName: String(args.toolName || ""),
        description: String(args.description || ""),
        inputSchema: (args.inputSchema as Record<string, unknown>) || { type: "object", properties: {} },
        moduleSource: String(args.moduleSource || ""),
        requestedBy: "eos_mcp_server",
      });
      if (!result.ok) return { success: false, error: result.error.message };
      return result.value;
    },

    eos_context_window: (args) => {
      const mgr = new EosContextWindowManager(projectRoot);
      return mgr.assemble(String(args.objective || ""), String(args.targetFile || ""), {
        tokenBudget: args.tokenBudget ? Number(args.tokenBudget) : undefined,
        includeTests: args.includeTests !== false,
        includeSpecs: args.includeSpecs !== false,
      });
    },

    eos_spec_drift: (args) => {
      const detector = new EosSpecDriftDetector(projectRoot);
      return detector.detect({
        driftThresholdDays: args.driftThresholdDays ? Number(args.driftThresholdDays) : undefined,
        checkOrphanSpecs: args.checkOrphanSpecs !== false,
      });
    },

    eos_pipeline: (args) => {
      const pipeline = new EosPipeline(projectRoot);
      return pipeline.solve({
        problem: String(args.problem || ""),
        targetFile: String(args.targetFile || ""),
        testCommand: String(args.testCommand || "node scripts/verify-cicd-pipeline.mjs"),
        testCwd: projectRoot,
        tokenBudget: args.tokenBudget ? Number(args.tokenBudget) : undefined,
        branchCount: args.branchCount ? Number(args.branchCount) : undefined,
        timeoutMs: args.timeoutMs ? Number(args.timeoutMs) : undefined,
      });
    },
  };
}
