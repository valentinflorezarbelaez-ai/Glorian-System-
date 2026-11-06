/**
 * Legacy MCP dispatch handlers: knowledge graph, cognition and evaluation.
 * SPEC-155: tools already served by EosMcpDispatchRegistry must not be duplicated here.
 */
import type { EosLegacyToolHandler } from "./eosLegacyDispatchContext.ts";
import { EosCognitiveEval } from "../../core/eosCognitiveEval.ts";
import { EosTitansMatrix } from "../../core/eosTitansMatrix.ts";
import { EosGoAccelerator } from "../../core/eosGoAccelerator.ts";
import { EosAudioDspKernel } from "../../core/eosAudioDspKernel.ts";
import { EosApolloHermesMesh } from "../../core/eosApolloHermesMesh.ts";
import { EosUniversalProjectAdapter } from "../../core/eosUniversalProjectAdapter.ts";
import { detectPolyglotPlan } from "../../core/eosPolyglotAdapter.ts";
import { EosBitemporalLedger } from "../../core/eosSpotifyNubankEngine.ts";
import { EosGlobalEdgeArbiter } from "../../core/eosGlobalEdgeArbiter.ts";
import { EosSamaelIbmNvidiaCore } from "../../core/eosSamaelIbmNvidiaCore.ts";
import { EosDisruptorRingEngine } from "../../core/eosDisruptorRingEngine.ts";
import { EosApexModelRouter } from "../../core/eosApexModelRouter.ts";
import { calculateBlastRadius, getFleetNodes, getTopologyMetrics } from "../../core/eosFleetTopology.ts";
import { runBenchmark, compressContext as compressWasmContext } from "../../core/eosWasmEngine.ts";
import { evaluateAlignment } from "../../core/eosJarvisSoul.ts";
import { EosIntrospectionEngine } from "../../core/eosIntrospectionEngine.ts";
import { EosImpenetrableShield } from "../../core/eosImpenetrableShield.ts";
import { EosDatalogVerifier } from "../../core/eosDatalogVerifier.ts";
import { EosTimeTravelSim } from "../../core/eosTimeTravelSim.ts";

const handlers: Record<string, EosLegacyToolHandler> = {
  "eos_query_knowledge_graph": (ctx, args, onProgress) => {
    const action = String(args.action || "stats").toLowerCase();
    const target = args.target ? String(args.target) : "";
    const maxDepth = typeof args.maxDepth === "number" ? Math.max(1, Math.min(10, args.maxDepth)) : 4;
    const direction = (args.direction === "OUT" || args.direction === "IN") ? args.direction : "BOTH";

    switch (action) {
      case "sync": {
        const syncResult = ctx.knowledgeGraph.syncGraph();
        return {
          action: "sync",
          status: "COMPLETED",
          ...syncResult
        };
      }
      case "stats": {
        const stats = ctx.knowledgeGraph.getGraphStats();
        return {
          action: "stats",
          ...stats
        };
      }
      case "neighbors": {
        if (!target) {
          throw new Error("Action 'neighbors' requires a 'target' node identifier");
        }
        const res = ctx.knowledgeGraph.getNeighbors(target, direction);
        return {
          action: "neighbors",
          target,
          direction,
          node: res.node,
          outgoingCount: res.outgoing.length,
          incomingCount: res.incoming.length,
          outgoing: res.outgoing,
          incoming: res.incoming
        };
      }
      case "blast_radius":
      case "subgraph": {
        if (!target) {
          throw new Error(`Action '${action}' requires a 'target' node identifier`);
        }
        const blast = ctx.knowledgeGraph.computeBlastRadius(target, { maxDepth, direction });
        return {
          action,
          ...blast
        };
      }
      case "find_orphans": {
        const orphans = ctx.knowledgeGraph.findOrphans();
        return {
          action: "find_orphans",
          ...orphans
        };
      }
      case "memory_closure": {
        if (!target) {
          throw new Error("Action 'memory_closure' requires a 'target' node identifier");
        }
        const closure = ctx.knowledgeGraph.computeMemoryClosure(target, { maxDepth });
        return {
          action: "memory_closure",
          ...closure
        };
      }
      default:
        throw new Error(`Unsupported knowledge graph action: '${action}'. Expected: stats, neighbors, blast_radius, find_orphans, subgraph, sync, memory_closure`);
    }
  },

  "eos_run_eval": (ctx, args, onProgress) => {
    const evaluator = new EosCognitiveEval();
    if (args.isText === true) {
      if (typeof args.target !== "string" || Buffer.byteLength(args.target, "utf8") > 100 * 1024) {
        throw new RangeError("Text evaluation input must be a string no larger than 100 KiB.");
      }
      return { scope: "LOCAL_HEURISTIC", certificationIssued: false, result: evaluator.evaluate(args.target, { isText: true }) };
    }
    const target = ctx.resolveProjectPath(args.target, "file");
    return { scope: "LOCAL_HEURISTIC", certificationIssued: false, result: evaluator.evaluate(target) };
  },

  "eos_titans_benchmark": (ctx, args, onProgress) => {
    const matrix = new EosTitansMatrix(ctx.projectRoot);
    const sub = String(args.titan || "all").toLowerCase();
    if (sub === "xirp") return matrix.benchmarkSpotifyXirp();
    if (sub === "spacex") return matrix.benchmarkSpaceXTmr();
    if (sub === "nvidia") return matrix.benchmarkNvidiaSimd();
    if (sub === "google") return matrix.reconcileGoogleBorg();
    if (sub === "xai") return matrix.benchmarkXaiFabric();
    return matrix.runAllTitans();
  },

  "eos_reconcile_state": (ctx, args, onProgress) => {
    const matrix = new EosTitansMatrix(ctx.projectRoot);
    return matrix.reconcileGoogleBorg();
  },

  "eos_go_accelerator": (ctx, args, onProgress) => {
    const accelerator = new EosGoAccelerator(ctx.projectRoot);
    const mode = String(args.mode || "benchmark").toLowerCase();
    if (mode === "bandit") {
      return accelerator.runBanditSimulation(Number(args.episodes) || 2000);
    }
    return accelerator.runBenchmark(Number(args.concurrency) || 2000);
  },

  "eos_audio_dsp_benchmark": (ctx, args, onProgress) => {
    const kernel = new EosAudioDspKernel();
    return kernel.benchmarkDsp(Number(args.frames) || 65536, Number(args.iterations) || 20);
  },

  "eos_apollo_rpc": (ctx, args, onProgress) => {
    const mesh = new EosApolloHermesMesh();
    const trace = mesh.generateTraceContext();
    const cb = mesh.getCircuitBreaker(String(args.serviceName || "default-service"));
    const partitionId = mesh.computePartition(`${args.serviceName}:${args.endpoint}`);
    return {
      serviceName: String(args.serviceName),
      endpoint: String(args.endpoint),
      success: cb.canExecute(),
      circuitState: cb.getState(),
      partitionId,
      traceparent: trace.headerString,
      dispatchedPayload: args.payload || {},
      timestamp: new Date().toISOString()
    };
  },

  "eos_universal_adapt": (ctx, args, onProgress) => {
    const target = ctx.resolveProjectPath(args.targetPath, "directory", ".");
    const adapter = new EosUniversalProjectAdapter(target);
    const report = adapter.audit(target);
    if (args.apply !== true) return { status: "LOCAL_INVENTORY_ONLY", report, writeApplied: false };
    return { status: "LOCAL_SCAFFOLD_REQUESTED", report, scaffold: adapter.elevate(target, { dryRun: false }) };
  },

  "eos_universal_fingerprint": (ctx, args, onProgress) => {
    const target = ctx.resolveProjectPath(args.targetPath, "directory", ".");
    const adapter = new EosUniversalProjectAdapter(target);
    return { scope: "LOCAL_INVENTORY", fingerprint: adapter.audit(target).fingerprint };
  },

  "eos_universal_scaffold": (ctx, args, onProgress) => {
    const target = ctx.resolveProjectPath(args.targetPath, "directory", ".");
    const adapter = new EosUniversalProjectAdapter(target);
    return adapter.elevate(target, { dryRun: args.applyToDisk !== true });
  },

  "eos_polyglot_bridge": (ctx, args, onProgress) => {
    const target = ctx.resolveProjectPath(args.targetPath, "directory", ".");
    return detectPolyglotPlan(target);
  },

  "eos_bitemporal_ledger": (ctx, args, onProgress) => {
    const ledger = new EosBitemporalLedger();
    const action = String(args.action || "get_root");
    if (action === "commit") {
      const key = String(args.idempotencyKey || `tx-${Date.now()}`);
      const entity = String(args.entityId || "entity-default");
      const payload = args.payload || { amount: 100, currency: "USD" };
      const fact = ledger.commitFact(key, entity, payload);
      return { status: "COMMITTED", fact, merkleRoot: ledger.getMerkleRoot() };
    }
    if (action === "query_as_of") {
      const asOf = Number(args.asOfTxTime) || Date.now();
      return { asOf, facts: ledger.queryAsOf(asOf) };
    }
    return { status: "ONLINE", merkleRoot: ledger.getMerkleRoot() };
  },

  "eos_global_edge_route": (ctx, args, onProgress) => {
    const arbiter = new EosGlobalEdgeArbiter("mcp-arbiter");
    if (args.city && typeof args.city === "string") {
      return arbiter.resolveByCity(args.city);
    }
    const lat = Number(args.latitude) || 4.7110;
    const lon = Number(args.longitude) || -74.0721;
    return arbiter.findOptimalRoute(lat, lon);
  },

  "eos_global_edge_benchmark": (ctx, args, onProgress) => {
    const arbiter = new EosGlobalEdgeArbiter("mcp-arbiter");
    const samples = Number(args.samples) || 1000;
    const p95 = Number(args.p95ThresholdMs) || 28.0;
    return arbiter.simulateHedgedRequests(samples, p95);
  },

  "eos_samael_ibm_nvidia": (ctx, args, onProgress) => {
    const core = new EosSamaelIbmNvidiaCore();
    const goal = String(args.goal || "EOS Universal Sovereign Elevation");
    return core.runApexSynthesis(goal);
  },

  "eos_disruptor_benchmark": (ctx, args, onProgress) => {
    const engine = new EosDisruptorRingEngine();
    const events = Number(args.events) || 500_000;
    const bytes = Number(args.payloadBytes) || 1_048_576;
    return engine.runMasterSpeedBenchmark(events, bytes);
  },

  "eos_wasm_benchmark": (ctx, args, onProgress) => {
    return runBenchmark(Number(args.iterations || 100000));
  },

  "eos_wasm_compress": (ctx, args, onProgress) => {
    return compressWasmContext(String(args.sourceCode || ""), Number(args.targetTokens || 200));
  },

  "eos_topology_blast_radius": (ctx, args, onProgress) => {
    return calculateBlastRadius(String(args.nodeId || "eos-core"));
  },

  "eos_soul_alignment": (ctx, args, onProgress) => {
    return evaluateAlignment(String(args.directive || ""));
  },

  "eos_autonomous_introspect": (ctx, args, onProgress) => {
    const engine = new EosIntrospectionEngine(ctx.projectRoot);
    return engine.runIntrospection();
  },

  "eos_military_shield_audit": (ctx, args, onProgress) => {
    const shield = new EosImpenetrableShield(ctx.projectRoot);
    return shield.runFullSecurityAudit();
  },

  "eos_query_topology": (ctx, args, onProgress) => {
    onProgress?.(50, 100, "Extracting Sovereign Fleet topology metrics");
    const result = {
      metrics: getTopologyMetrics(),
      nodes: getFleetNodes(),
      rings: [
        { ring: 1, name: "Sovereign Fleet Platforms" },
        { ring: 2, name: "Core Engineering Engines" },
        { ring: 3, name: "Native High-Performance Kernels" }
      ]
    };
    onProgress?.(100, 100, "Topology query completed");
    return result;
  },

  "eos_model_route": (ctx, args, onProgress) => {
    onProgress?.(50, 100, "Routing directive across Sovereign Five AI Matrix");
    const router = new EosApexModelRouter(ctx.projectRoot);
    const result = router.routeTask(String(args.directivePrompt || ""), String(args.sourceContext || ""));
    onProgress?.(100, 100, "Optimal frontier model selected");
    return result;
  },

  "eos_datalog_query": (ctx, args, onProgress) => {
    onProgress?.(30, 100, "Constructing EDB facts and evaluation rules");
    const verifier = new EosDatalogVerifier(ctx.projectRoot);
    onProgress?.(70, 100, "Evaluating Datalog fixpoint transitive closure");
    const blast = verifier.queryBlastRadius(String(args.targetModule || "src/core/eosJarvisSoul.ts"));
    onProgress?.(100, 100, "Fixpoint reached; blast radius calculated");
    return blast;
  },

  "eos_time_travel_simulate": (ctx, args, onProgress) => {
    onProgress?.(30, 100, "Initializing deterministic discrete clock hypervisor");
    const seed = typeof args.seed === "number" ? args.seed : 948102;
    const maxEvents = typeof args.maxEvents === "number" ? args.maxEvents : 50;
    const sim = new EosTimeTravelSim(seed);
    sim.scheduleEvent("replica-1", "INIT_STATE", 10);
    sim.scheduleEvent("replica-2", "PROPOSE_CONSENSUS", 35);
    sim.scheduleEvent("replica-3", "HEARTBEAT_POLL", 20);
    onProgress?.(80, 100, "Replaying deterministic event trajectory");
    const receipt = sim.runSimulation(maxEvents);
    onProgress?.(100, 100, "Simulation completed with cryptographic state hash");
    return receipt;
  },
};

export const KNOWLEDGE_LEGACY_HANDLERS: Readonly<Record<string, EosLegacyToolHandler>> = Object.freeze(handlers);
