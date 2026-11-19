/**
 * @file cliKnowledgeGraphReflex.mjs
 * @description CLI handler for SPEC-345 / CHANGE-207: Closed-Loop Knowledge Graph & Semantic Reflex Engine.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditKnowledgeGraphReflex, createKnowledgeGraph } from "../../src/core/eosKnowledgeGraphReflex.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("KNOWLEDGE_GRAPH_REFLEX_RECEIPT.json", root);
}

function parseStringFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  return arg ? arg.split("=")[1] : defaultValue;
}

function parseIntFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const parsed = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function buildSampleGraph() {
  const kg = createKnowledgeGraph();
  kg.addNode({ id: "SPEC-345", type: "SPECIFICATION", label: "Knowledge Graph Spec" });
  kg.addNode({ id: "INV-01", type: "INVARIANT", label: "Cycle-Free DAG" });
  kg.addNode({ id: "SRC-GRAPH", type: "FILE", label: "eosKnowledgeGraphReflex.ts" });
  kg.addNode({ id: "TEST-GRAPH", type: "FILE", label: "eosKnowledgeGraphReflex.test.mjs" });
  kg.addNode({ id: "DEC-001", type: "DECISION", label: "Tarjan SCC vs External DB" });

  kg.addEdge({ id: "E1", source: "SPEC-345", target: "INV-01", type: "PRESERVES" });
  kg.addEdge({ id: "E2", source: "INV-01", target: "SRC-GRAPH", type: "GOVERNS" });
  kg.addEdge({ id: "E3", source: "SRC-GRAPH", target: "TEST-GRAPH", type: "DEPENDS_ON" });
  kg.addEdge({ id: "E4", source: "DEC-001", target: "SRC-GRAPH", type: "GOVERNS" });

  return kg;
}

const HANDLERS = {};

async function cmd_graph_query(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const nodeId = parseStringFlag(args, "--node=", null);
  const kg = buildSampleGraph();

  if (nodeId) {
    const node = kg.getNode(nodeId);
    if (isJson) {
      console.log(JSON.stringify(node || null, null, 2));
    } else if (node) {
      console.log(`=== Knowledge Graph Node: ${node.id} ===`);
      console.log(`Type     : ${node.type}`);
      console.log(`Label    : ${node.label}`);
      console.log(`Created  : ${node.createdAt}`);
    } else {
      console.log(`Node '${nodeId}' not found.`);
    }
    return;
  }

  const nodes = kg.listNodes();
  const edges = kg.listEdges();

  if (isJson) {
    console.log(JSON.stringify({ nodes, edges }, null, 2));
  } else {
    console.log("=== Knowledge Graph Inventory (SPEC-345) ===");
    console.log(`Total Nodes : ${nodes.length}`);
    console.log(`Total Edges : ${edges.length}`);
    for (const n of nodes) {
      console.log(`  [${n.type}] ${n.id} — ${n.label}`);
    }
  }
}

async function cmd_graph_blast_radius(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const rootId = parseStringFlag(args, "--node=", "SPEC-345");
  const depth = parseIntFlag(args, "--depth=", 3);
  const direction = parseStringFlag(args, "--direction=", "DOWNSTREAM");

  const kg = buildSampleGraph();
  const report = kg.computeBlastRadius(rootId, { maxDepth: depth, direction });

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== Knowledge Graph Blast Radius (SPEC-345) ===");
    console.log(`Root Node      : ${report.rootId}`);
    console.log(`Direction      : ${report.direction}`);
    console.log(`Max Depth      : ${report.maxDepth}`);
    console.log(`Impacted Count : ${report.impactedNodes.length}`);
    console.log(`Severity Score : ${report.severityScore}`);
    for (const n of report.impactedNodes) {
      console.log(`  - [Depth ${n.depth}] ${n.id} (${n.type}) via ${n.path.join(" -> ")}`);
    }
  }
}

async function cmd_graph_cycles(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const injectCycle = args.includes("--cyclic");

  const kg = buildSampleGraph();
  if (injectCycle) {
    kg.addEdge({ id: "E-CYCLE", source: "TEST-GRAPH", target: "SPEC-345", type: "MUTATES" });
  }

  const report = kg.findCycles();

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== Knowledge Graph Cycle Detection (Tarjan SCC) ===");
    console.log(`Has Cycles   : ${report.hasCycles ? "YES (VIOLATION)" : "NO (CONFORMING DAG)"}`);
    console.log(`Cycle Count  : ${report.cycleCount}`);
    if (report.hasCycles) {
      for (let i = 0; i < report.cycles.length; i++) {
        console.log(`  Cycle ${i + 1}: ${report.cycles[i].join(" -> ")}`);
      }
    }
  }
}

async function cmd_graph_pagerank(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const kg = buildSampleGraph();
  const report = kg.computePageRank();

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== Knowledge Graph PageRank Centrality ===");
    console.log(`Iterations   : ${report.iterations}`);
    console.log(`Damping      : ${report.dampingFactor}`);
    console.log(`Delta        : ${report.convergenceDelta}`);
    const sorted = Object.entries(report.ranks).sort(([, a], [, b]) => b - a);
    for (const [id, rank] of sorted) {
      console.log(`  - ${id.padEnd(12)} : ${Math.round(rank * 10000) / 100}%`);
    }
  }
}

async function cmd_graph_reflex(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const entityId = parseStringFlag(args, "--node=", "SRC-GRAPH");

  const kg = buildSampleGraph();
  let reflexTriggered = false;
  kg.registerReflexHook("NODE_UPDATED", (ev) => {
    reflexTriggered = true;
    return [
      {
        id: `reflex-${Date.now()}`,
        triggerEntityId: ev.triggerEntityId,
        eventType: "NODE_UPDATED",
        actionType: "INVALIDATE_CACHE",
        actionPayload: { target: ev.triggerEntityId, status: "DIRTY" },
        depth: ev.depth ?? 0,
      },
    ];
  });

  const actions = kg.dispatchReflex({
    triggerEntityId: entityId,
    eventType: "NODE_UPDATED",
    depth: 0,
    lineage: [entityId],
  });

  if (isJson) {
    console.log(JSON.stringify({ reflexTriggered, actions }, null, 2));
  } else {
    console.log("=== Knowledge Graph Reflex Dispatch ===");
    console.log(`Triggered Entity : ${entityId}`);
    console.log(`Hook Triggered   : ${reflexTriggered}`);
    console.log(`Dispatched Count : ${actions.length}`);
    for (const a of actions) {
      console.log(`  - Action [${a.actionType}] Depth: ${a.depth} Payload: ${JSON.stringify(a.actionPayload)}`);
    }
  }
}

async function cmd_graph_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = auditKnowledgeGraphReflex(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Knowledge Graph & Reflex Engine Audit (SPEC-345) ===");
    console.log(`Spec               : ${receipt.spec}`);
    console.log(`Nodes Verified     : ${receipt.nodeCount}`);
    console.log(`Edges Verified     : ${receipt.edgeCount}`);
    console.log(`Cycle Detection    : ${receipt.cyclesDetected ? "PASS" : "FAIL"}`);
    console.log(`Topological DAG    : ${receipt.topologicalSortValid ? "PASS" : "FAIL"}`);
    console.log(`Blast Radius       : ${receipt.blastRadiusVerified ? "PASS" : "FAIL"}`);
    console.log(`Reflex Bounded     : ${receipt.reflexCascadeBounded ? "PASS" : "FAIL"}`);
    console.log(`All Passed         : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest     : ${receipt.sha256}`);
    console.log(`Receipt Saved      : ${receiptPath}`);
  }
}

HANDLERS["toolchain:graph:query"] = cmd_graph_query;
HANDLERS["toolchain:graph:blast-radius"] = cmd_graph_blast_radius;
HANDLERS["toolchain:graph:cycles"] = cmd_graph_cycles;
HANDLERS["toolchain:graph:pagerank"] = cmd_graph_pagerank;
HANDLERS["toolchain:graph:reflex"] = cmd_graph_reflex;
HANDLERS["toolchain:graph:audit"] = cmd_graph_audit;

export async function handleKnowledgeGraphCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:graph command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
