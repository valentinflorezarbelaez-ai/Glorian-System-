/**
 * EOS SYSTEM — PHASE-6 DOMAIN MCP HANDLERS (SPEC-155 / T7c Max-2)
 * Fleet / Apex / FinOps / Product / Synapse / Planetary residual extract.
 * Explicitly NOT Level 5 — sovereign 5/5 WITHIN_TESTED_SCOPE only.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

import { EosApexModelRouter } from "../../core/eosApexModelRouter.ts";
import { EosFleetElevator } from "../../core/eosFleetElevator.ts";
import { EosSpotifyAgenticFactory } from "../../core/eosSpotifyAgenticFactory.ts";
import { EosFleetPulseEngine } from "../../core/eosFleetPulseEngine.ts";
import { EosFleetProductionVerifier } from "../../core/eosFleetProductionVerifier.ts";
import { EosFinOpsBudget } from "../../core/eosFinOpsBudget.ts";
import { EosAgenticFinOpsGovernor } from "../../core/eosAgenticFinOpsGovernor.ts";
import {
  EosUniversalProductFoundry,
  type ProductManifest
} from "../../core/eosUniversalProductFoundry.ts";
import { EosProductDeliveryOrchestrator } from "../../core/eosProductDeliveryOrchestrator.ts";
import { EosMetaCognitiveSynapse } from "../../core/eosMetaCognitiveSynapse.ts";
import {
  EosCrossFleetNeuralSynapse,
  type SynapticPatternCategory
} from "../../core/eosCrossFleetNeuralSynapse.ts";
import { EosPlanetaryMonorepoGovernor } from "../../core/eosPlanetaryMonorepoGovernor.ts";
import { EosPlanetaryMultiCloudEvacuationMesh } from "../../core/eosPlanetaryMultiCloudEvacuationMesh.ts";
import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";
import { PHASE6_MIGRATED_TOOL_NAMES } from "./eosMcpPhase6ToolNames.ts";

export { PHASE6_MIGRATED_TOOL_NAMES };

export interface Phase6DomainHandlerDeps {
  readonly projectRoot: string;
  readonly resolveProjectPath: (
    value: unknown,
    kind: "file" | "directory",
    fallback?: string
  ) => string;
}

const globalFinOpsGovernor = EosAgenticFinOpsGovernor.getInstance();
const globalPlanetaryGovernor = EosPlanetaryMonorepoGovernor.getInstance();
const globalCrossFleetSynapse = EosCrossFleetNeuralSynapse.getInstance();
const globalMultiCloudEvacuationMesh = EosPlanetaryMultiCloudEvacuationMesh.getInstance();

export function createPhase6DomainHandlers(
  deps: Phase6DomainHandlerDeps
): Readonly<Record<string, McpToolHandler>> {
  const { projectRoot, resolveProjectPath } = deps;

  return {
    eos_fleet_registry_sync: (args) => {
      const dryRun = args?.dryRun !== false;
      const audit = Boolean(args?.audit ?? false);
      const cliArgs = [path.join(projectRoot, "scripts/eos-fleet-registry-sync.mjs"), "--json"];
      if (dryRun) cliArgs.push("--dry-run");
      if (audit) cliArgs.push("--audit");
      const out = execFileSync(process.execPath, cliArgs, {
        cwd: projectRoot,
        encoding: "utf8",
        timeout: 60000,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
      return JSON.parse(out.trim());
    },

    eos_fleet_mission_control: (args) => {
      const probe = Boolean(args?.probe ?? false);
      const cliArgs = [path.join(projectRoot, "scripts/eos-fleet-mission-control.mjs"), "--json"];
      if (probe) cliArgs.push("--probe");
      const out = execFileSync(process.execPath, cliArgs, {
        cwd: projectRoot,
        encoding: "utf8",
        timeout: 60000,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
      return JSON.parse(out.trim());
    },

    eos_fleet_elevate: (args) => {
      const inventory = new EosFleetElevator(projectRoot).elevateFleet({ dryRun: true });
      if (args.apply !== true) return { status: "LOCAL_INVENTORY_ONLY", inventory, writeApplied: false };
      const targetProject = typeof args.targetProjectId === "string" ? args.targetProjectId : "";
      if (!targetProject || Buffer.byteLength(targetProject, "utf8") > 128) {
        throw new Error("Applying requires one registered targetProjectId no longer than 128 bytes.");
      }
      const factory = new EosSpotifyAgenticFactory(projectRoot);
      const result = factory.executeFleetshift({
        migrationId: `MCP-${Date.now()}`,
        description: "Create one missing local catalog-info.yaml template after checkout verification.",
        action: "apply_backstage_rfc42",
        targetFleet: [targetProject],
        dryRun: false
      });
      return { status: "SINGLE_PROJECT_ACTION", inventory, result };
    },

    eos_fleet_verify: (args) => {
      const target = typeof args?.target === "string" ? args.target.trim() : "all";
      const recordToLedger = args?.recordToLedger === true;
      const simulateDegraded = args?.simulateDegraded === true;
      return EosFleetProductionVerifier.evaluateFleetSync({
        target,
        projectRoot,
        recordToLedger,
        simulateDegraded
      });
    },

    eos_fleet_pulse: (args) => {
      const engine = new EosFleetPulseEngine(projectRoot);
      const report = engine.auditFleetPulse();
      const format = String(args?.format || "json").toLowerCase();
      if (format === "table") {
        return {
          table: EosFleetPulseEngine.formatPulseTable(report),
          totalProjects: report.totalProjects,
          quorumPercentage: report.fleetHealthQuorumPercentage,
          sha256Receipt: report.sha256Receipt,
          timestampIso: report.timestampIso
        };
      }
      return report;
    },

    eos_apex_route_model: (args) => {
      const router = new EosApexModelRouter(projectRoot);
      return router.routeTask(String(args.directivePrompt || ""), String(args.sourceContext || ""));
    },

    eos_apex_compress_context: (args) => {
      const router = new EosApexModelRouter(projectRoot);
      return router.compressContext(String(args.sourceContent || ""), String(args.fileName || "source.ts"));
    },

    eos_apex_autonomous_heal: (args) => {
      const router = new EosApexModelRouter(projectRoot);
      const filePath = resolveProjectPath(args.filePath, "file");
      return router.healFile(filePath, args.apply !== true);
    },

    eos_apex_go_benchmark: (args) => {
      const router = new EosApexModelRouter(projectRoot);
      return router.runGoThroughputBenchmark();
    },

    eos_finops_budget_check: (_args, ctx) => {
      ctx.onProgress?.(50, 100, "Auditing token spend ledger and Cajitas status");
      const budget = new EosFinOpsBudget(15.0);
      ctx.onProgress?.(100, 100, "FinOps report compiled");
      return budget.getReport();
    },

    eos_finops_route_task: (args) => {
      const directive = String(args.directive || "");
      const tokens = typeof args.estimatedTokens === "number" ? args.estimatedTokens : undefined;
      return globalFinOpsGovernor.classifyTaskCostTier(directive, tokens);
    },

    eos_finops_evaluate_stagnation: (args) => {
      const diffs = Array.isArray(args.diffHistory) ? args.diffHistory.map(String) : [];
      const passed = Boolean(args.testPassed);
      return globalFinOpsGovernor.evaluateStagnation(diffs, passed);
    },

    eos_finops_wallet_status: (args) => {
      if (args.reset) globalFinOpsGovernor.reset();
      const missionId = args.missionId ? String(args.missionId) : undefined;
      if (missionId) {
        return globalFinOpsGovernor.recordTokenUsage(missionId, 0, 0, "TIER_1_LOCAL_SLM");
      }
      return globalFinOpsGovernor.getStatus();
    },

    eos_product_foundry_create: (args, ctx) => {
      ctx.onProgress?.(30, 100, "Synthesizing hexagonal product blueprint");
      const name = String(args.name || "Apex Product Core");
      const domain = String(args.domain || "general");
      const tier = (args.tier as ProductManifest["tier"]) || "ENTERPRISE";
      const entities =
        Array.isArray(args.entities) && args.entities.length > 0
          ? args.entities
          : ["PrimaryRecord", "AuditTrail"];
      const commands =
        Array.isArray(args.commands) && args.commands.length > 0
          ? args.commands
          : ["CreateRecord", "VerifyRecord"];
      const platforms =
        Array.isArray(args.platforms) && args.platforms.length > 0
          ? args.platforms
          : ["web", "distributed-backend"];
      const manifest: ProductManifest = {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        domain,
        description: `Autonomous product blueprint for ${name}`,
        tier,
        platforms,
        entities,
        commands
      };
      const blueprint = EosUniversalProductFoundry.createProductBlueprint(manifest);
      const report = EosUniversalProductFoundry.validateProductTopology(blueprint);
      ctx.onProgress?.(100, 100, "Product blueprint created and verified");
      return {
        status: "BLUEPRINT_CREATED",
        blueprint,
        validation: report,
        totalFilesGenerated: blueprint.domainEntities.length + blueprint.useCases.length + 2
      };
    },

    eos_product_foundry_validate: (args, ctx) => {
      ctx.onProgress?.(30, 100, "Validating product topology and boundary rules");
      const domain = String(args.domain || "fintech");
      const tier = (args.tier as ProductManifest["tier"]) || "MISSION_CRITICAL";
      const manifest: ProductManifest = {
        id: `${domain}-validation-probe`,
        name: `${domain} Validation Probe`,
        domain,
        description: "Topological verification probe",
        tier,
        platforms: ["distributed-backend"],
        entities: ["SampleEntity"],
        commands: ["ExecuteSample"]
      };
      const blueprint = EosUniversalProductFoundry.createProductBlueprint(manifest);
      const report = EosUniversalProductFoundry.validateProductTopology(blueprint);
      ctx.onProgress?.(100, 100, "Topology validation complete");
      return report;
    },

    eos_product_deliver_run: (args, ctx) => {
      ctx.onProgress?.(15, 100, "Starting LADDER-15 Product Delivery Golden Path");
      const name = String(args.name || "Demo Ledger MVP");
      const domain = String(args.domain || "fintech-ledger");
      const tier = (args.tier as ProductManifest["tier"]) || "MVP";
      const write = args.write === true;
      const entities =
        Array.isArray(args.entities) && args.entities.length > 0
          ? args.entities.map(String)
          : ["LedgerEntry", "Account"];
      const commands =
        Array.isArray(args.commands) && args.commands.length > 0
          ? args.commands.map(String)
          : ["PostEntry", "ReconcileBooks"];
      const manifest: ProductManifest = {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        domain,
        description: `Golden Path delivery for ${name}`,
        tier,
        platforms: ["distributed-backend", "web"],
        entities,
        commands,
        compliance: ["SLSA_4"]
      };
      ctx.onProgress?.(45, 100, "Foundry + Sovereign Loop + verification gates");
      const result = EosProductDeliveryOrchestrator.deliverProduct(manifest, {
        dryRun: !write,
        projectRoot,
        enforceGates: true,
        externalSatellite: false
      });
      ctx.onProgress?.(100, 100, `Delivery ${result.status}`);
      return {
        status: result.status,
        reason: result.reason ?? null,
        track: result.track,
        dryRun: result.dryRun,
        intelGovernanceStagesCompleted: result.intelGovernanceStagesCompleted,
        gateResults: result.gateResults,
        scorecard: result.scorecard,
        sddPackagePath: result.sddPackagePath,
        epistemicState: result.epistemicState,
        sha256Receipt: result.sha256Receipt,
        deploymentAttempted: result.deploymentAttempted,
        durationMs: result.durationMs
      };
    },

    eos_product_deliver_status: () => EosProductDeliveryOrchestrator.getStatus(),

    eos_synapse_arbitrate: (args) => {
      const candidates = Array.isArray(args.candidates) ? args.candidates : [];
      return EosMetaCognitiveSynapse.arbitrateIntents(candidates);
    },

    eos_synapse_propagate_golden_path: (args) => {
      const patternId = String(args.patternId || "");
      const targetRepos = Array.isArray(args.targetRepos)
        ? args.targetRepos.map(String)
        : undefined;
      return globalCrossFleetSynapse.propagateGoldenPath(patternId, targetRepos);
    },

    eos_synapse_fleet_knowledge_query: (args) => {
      const filter = args.categoryFilter
        ? (String(args.categoryFilter).toUpperCase() as SynapticPatternCategory)
        : undefined;
      return globalCrossFleetSynapse.queryFleetKnowledge(filter);
    },

    eos_synapse_mesh_status: (args) => {
      if (args.reset) globalCrossFleetSynapse.reset();
      return globalCrossFleetSynapse.getStatus();
    },

    eos_planetary_sparse_project: (args) => {
      const targetFile = String(args.targetFile || "");
      const monorepoNodes = Array.isArray(args.monorepoNodes) ? args.monorepoNodes : [];
      return globalPlanetaryGovernor.projectSparseClosure(targetFile, monorepoNodes);
    },

    eos_planetary_mesh_evacuate_traffic: (args) => {
      const providerId = String(args.providerId || "");
      const reason = args.reason ? String(args.reason) : undefined;
      return globalMultiCloudEvacuationMesh.evacuateCloudProvider(providerId, reason);
    },

    eos_planetary_mesh_health_matrix: () => globalMultiCloudEvacuationMesh.getHealthMatrix(),

    eos_planetary_mesh_status: (args) => {
      if (args.reset) globalMultiCloudEvacuationMesh.reset();
      return globalMultiCloudEvacuationMesh.getStatus();
    }
  };
}
