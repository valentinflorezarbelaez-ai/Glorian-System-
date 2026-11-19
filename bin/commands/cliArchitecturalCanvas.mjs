/**
 * @file cliArchitecturalCanvas.mjs
 * @description CLI handler for SPEC-358 / CHANGE-220: Live Self-Introspecting Architectural Canvas & Bi-Directional Interactive Topology.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosArchitecturalCanvasCore,
  EosCanvasLayoutEngine,
  EosCanvasSvgRenderer,
  EosInteractiveTopologyManager,
  EosTopologyHarvester,
} from "../../src/core/eosArchitecturalCanvas.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("ARCHITECTURAL_CANVAS_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_canvas_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosArchitecturalCanvasCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Live Self-Introspecting Architectural Canvas (SPEC-358) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Nodes Harvested         : ${receipt.nodesHarvested}`);
    console.log(`Edges Harvested         : ${receipt.edgesHarvested}`);
    console.log(`Layout Computation Time : ${receipt.benchmark.layoutDurationUs.toFixed(1)} µs`);
    console.log(`Blast Radius Traversal  : ${receipt.benchmark.blastRadiusDurationUs.toFixed(1)} µs`);
    console.log(`SVG Vector Render Time  : ${receipt.benchmark.svgRenderDurationUs.toFixed(1)} µs`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelVerified ? "PASS" : "FAIL"}`);
    console.log(`Verdict                 : ${receipt.verdict}`);
    console.log(`Epistemic State         : ${receipt.epistemicState}`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_canvas_graph(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const { nodes, edges } = EosTopologyHarvester.harvest(ROOT);
  const topology = EosCanvasLayoutEngine.layout(nodes, edges);

  if (isJson) {
    console.log(JSON.stringify(topology, null, 2));
  } else {
    console.log("=== Architectural Canvas Topology DAG ===");
    console.log(`Total Nodes  : ${topology.nodes.length}`);
    console.log(`Total Edges  : ${topology.edges.length}`);
    console.log(`Total Layers : ${topology.totalLayers}`);
    console.log(`Canvas BBox  : ${topology.width}x${topology.height} px`);
    console.log(
      `Sample Nodes : ${topology.nodes
        .slice(0, 5)
        .map((n) => n.id)
        .join(", ")}...`,
    );
  }
}

async function cmd_canvas_render(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const { nodes, edges } = EosTopologyHarvester.harvest(ROOT);
  const topology = EosCanvasLayoutEngine.layout(nodes, edges);
  const svg = EosCanvasSvgRenderer.render(topology);

  if (isJson) {
    console.log(JSON.stringify({ length: svg.length, svg }, null, 2));
  } else {
    console.log(svg);
  }
}

async function cmd_canvas_blast(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const positionalArgs = args.filter((a) => a !== commandContext.command && !a.startsWith("-"));
  const targetId = positionalArgs[0] || "eos-system";

  const { nodes, edges } = EosTopologyHarvester.harvest(ROOT);
  const manager = new EosInteractiveTopologyManager(nodes, edges);
  const report = manager.calculateBlastRadius(targetId);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`=== Causal Blast Radius Analysis: ${report.targetNodeId} ===`);
    console.log(`Risk Level              : ${report.riskLevel}`);
    console.log(`Total Impacted          : ${report.totalImpactedCount}`);
    console.log(`Upstream Impacted       : ${report.upstreamImpacted.length} components`);
    console.log(`Downstream Dependencies : ${report.downstreamDependencies.length} components`);
  }
}

HANDLERS["toolchain:canvas:audit"] = cmd_canvas_audit;
HANDLERS["toolchain:canvas:graph"] = cmd_canvas_graph;
HANDLERS["toolchain:canvas:render"] = cmd_canvas_render;
HANDLERS["toolchain:canvas:blast"] = cmd_canvas_blast;

export async function handleArchitecturalCanvasCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:canvas command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
