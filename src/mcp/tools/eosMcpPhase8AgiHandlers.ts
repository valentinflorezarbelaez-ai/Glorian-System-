/**
 * EOS SYSTEM — PHASE-8 AGI / FORGE MCP HANDLERS (merge parity with main v64–v66)
 * Consulting deliverables, Tree-of-Thought solving, dynamic tool forging,
 * context-window assembly and spec-drift detection.
 */

import { EosAgenticHarnessYieldCore } from "../../core/eosAgenticHarnessYield.ts";
import { EosAgiCore } from "../../core/eosAgiCore.ts";
import { EosCausalStructuralModelCore } from "../../core/eosCausalStructuralModel.ts";
import { EosClosedLoopRepoAutopilotCore } from "../../core/eosClosedLoopRepoAutopilot.ts";
import { EosConsultantCore } from "../../core/eosConsultantCore.ts";
import { EosContextWindowManager } from "../../core/eosContextWindowManager.ts";
import { EosDiscreteEventSimulationHypervisorCore } from "../../core/eosDiscreteEventSimulationHypervisor.ts";
import { EosDynamicToolForge } from "../../core/eosDynamicToolForge.ts";
import { EosEuvInverseLithographyWavefrontCore } from "../../core/eosEuvInverseLithographyWavefront.ts";
import { EosMetamorphicDifferentialBlindSpotCore } from "../../core/eosMetamorphicDifferentialBlindSpot.ts";
import { EosOntologicalHypergraphCore } from "../../core/eosOntologicalHypergraph.ts";
import { EosPhysicsInformedHamiltonianPdeCore } from "../../core/eosPhysicsInformedHamiltonianPde.ts";
import { EosPipeline } from "../../core/eosPipeline.ts";
import { EosPostQuantumThresholdMpcCore } from "../../core/eosPostQuantumThresholdMpc.ts";
import { EosSpecDriftDetector } from "../../core/eosSpecDriftDetector.ts";
import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";
import { PHASE8_MIGRATED_TOOL_NAMES } from "./eosMcpPhase8ToolNames.ts";

export { PHASE8_MIGRATED_TOOL_NAMES };

export interface Phase8AgiHandlerDeps {
  readonly projectRoot: string;
}

function positiveFiniteNumber(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function createPhase8AgiHandlers(deps: Phase8AgiHandlerDeps): Readonly<Record<string, McpToolHandler>> {
  const { projectRoot } = deps;

  return {
    eos_consult: (args) => {
      const consultant = new EosConsultantCore(projectRoot);
      const problem = typeof args.problem === "string" ? args.problem.trim() : "";
      if (!problem) return { error: "problem field is required" };
      const deliverable = consultant.engage({
        problem,
        engagementType: typeof args.engagementType === "string" ? (args.engagementType as any) : undefined,
        techStack:
          typeof args.techStack === "string" || Array.isArray(args.techStack) ? (args.techStack as any) : undefined,
        context: typeof args.context === "string" ? args.context : undefined,
        constraints: typeof args.constraints === "string" ? args.constraints : undefined,
      });
      const filePath = consultant.saveDeliverable(deliverable);
      return { ...deliverable, savedTo: filePath };
    },

    eos_agi_solve: (args, ctx) => {
      const core = new EosAgiCore(projectRoot);
      const branches = Array.isArray(args.branches)
        ? args.branches.filter((b) => b !== null && typeof b === "object")
        : [];
      const objective = typeof args.objective === "string" ? args.objective.trim() : "";
      const testCommand =
        typeof args.testCommand === "string" && args.testCommand.trim()
          ? args.testCommand.trim()
          : "node scripts/verify-cicd-pipeline.mjs";

      const progressEvents: unknown[] = [];
      const result = core.solve(objective, branches, {
        testCommand,
        testCwd: projectRoot,
        timeoutMs: positiveFiniteNumber(args.timeoutMs, 60_000)!,
        onProgress: (event) => {
          progressEvents.push(event);
          ctx?.onProgress?.(progressEvents.length, branches.length, event.message);
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
      const inputSchema =
        args.inputSchema !== null && typeof args.inputSchema === "object" && !Array.isArray(args.inputSchema)
          ? (args.inputSchema as Record<string, unknown>)
          : { type: "object", properties: {} };
      const result = forge.forge({
        toolName: typeof args.toolName === "string" ? args.toolName.trim() : "",
        description: typeof args.description === "string" ? args.description.trim() : "",
        inputSchema,
        moduleSource: typeof args.moduleSource === "string" ? args.moduleSource.trim() : "",
        requestedBy: "eos_mcp_server",
      });
      if (!result.ok) return { success: false, error: result.error.message };
      return result.value;
    },

    eos_context_window: (args) => {
      const mgr = new EosContextWindowManager(projectRoot);
      return mgr.assemble(
        typeof args.objective === "string" ? args.objective.trim() : "",
        typeof args.targetFile === "string" ? args.targetFile.trim() : "",
        {
          tokenBudget: positiveFiniteNumber(args.tokenBudget),
          includeTests: args.includeTests !== false,
          includeSpecs: args.includeSpecs !== false,
        },
      );
    },

    eos_spec_drift: (args) => {
      const detector = new EosSpecDriftDetector(projectRoot);
      return detector.detect({
        driftThresholdDays: positiveFiniteNumber(args.driftThresholdDays),
        checkOrphanSpecs: args.checkOrphanSpecs !== false,
      });
    },

    eos_pipeline: (args) => {
      const pipeline = new EosPipeline(projectRoot);
      return pipeline.solve({
        problem: typeof args.problem === "string" ? args.problem.trim() : "",
        targetFile: typeof args.targetFile === "string" ? args.targetFile.trim() : "",
        testCommand:
          typeof args.testCommand === "string" && args.testCommand.trim()
            ? args.testCommand.trim()
            : "node scripts/verify-cicd-pipeline.mjs",
        testCwd: projectRoot,
        tokenBudget: positiveFiniteNumber(args.tokenBudget),
        branchCount: positiveFiniteNumber(args.branchCount),
        timeoutMs: positiveFiniteNumber(args.timeoutMs),
      });
    },

    eos_ontological_hypergraph_audit: () => {
      const engine = new EosOntologicalHypergraphCore();
      engine.assertEntity({ entityId: "comp:alpha", name: "Alpha", kind: "Component", validFrom: 1, validTo: 10 });
      engine.assertEntity({ entityId: "comp:beta", name: "Beta", kind: "Component", validFrom: 1, validTo: 10 });
      engine.assertHyperedge({
        edgeId: "edge:alpha-beta",
        relation: "DIRECT_LINK",
        participants: [
          { entityId: "comp:alpha", role: "SOURCE" },
          { entityId: "comp:beta", role: "TARGET" },
        ],
        validFrom: 1,
        validTo: 10,
      });
      engine.resolveEntity({ sourceId: "ext:alpha", name: "Alpha", kind: "Component" });
      return engine.auditHypergraph();
    },

    eos_desh_simulation_audit: (args) => {
      const rawSeed = typeof args.seed === "string" ? args.seed.trim() : "";
      const seed = rawSeed || "sovereign-audit-seed-42";
      const hypervisor = new EosDiscreteEventSimulationHypervisorCore({ seed });
      hypervisor.registerNode("alpha", "COORDINATOR", { eventCount: 0 });
      hypervisor.registerNode("beta", "WORKER", { eventCount: 0 });
      hypervisor.sendEvent("alpha", "beta", "JOB-1", { task: "compute" }, 100);
      hypervisor.sendEvent("beta", "alpha", "JOB-DONE", { status: "OK" }, 200);
      hypervisor.step();
      hypervisor.createCheckpoint("audit-cp-1");
      hypervisor.step();
      return hypervisor.audit();
    },

    eos_pqmpc_threshold_audit: () => new EosPostQuantumThresholdMpcCore().audit(),

    eos_pinn_hamiltonian_audit: () => new EosPhysicsInformedHamiltonianPdeCore().audit(),

    eos_euv_ilt_wavefront_audit: () => new EosEuvInverseLithographyWavefrontCore().audit(),

    eos_causal_scm_audit: () => new EosCausalStructuralModelCore().audit(),

    eos_agentic_harness_audit: () => new EosAgenticHarnessYieldCore().audit(),

    eos_closed_loop_autopilot_audit: () => new EosClosedLoopRepoAutopilotCore({ projectRoot }).audit(),

    eos_blindspot_fleet_audit: (args: Record<string, unknown>) => {
      const iters = positiveFiniteNumber(args?.iterations, 50);
      const seed = positiveFiniteNumber(args?.seed, 2026341);
      return new EosMetamorphicDifferentialBlindSpotCore().auditFleetProjects({
        projectRoot,
        iterationsPerProject: iters,
        seed,
      });
    },

    eos_blindspot_hunter_audit: () => new EosMetamorphicDifferentialBlindSpotCore().audit(),
  };
}
