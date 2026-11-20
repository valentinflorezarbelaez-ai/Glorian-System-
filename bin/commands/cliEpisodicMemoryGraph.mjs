/**
 * @file cliEpisodicMemoryGraph.mjs
 * @description CLI handler for SPEC-369 / CHANGE-231: Episodic Memory Graph & Cross-Project Experience Synapse.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosEpisodicMemoryGraph } from "../../src/core/eosEpisodicMemoryGraph.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("EPISODIC_MEMORY_GRAPH_RECEIPT.json", root);
}

function getPositionalArg(args, commandContext) {
  return args.find((a) => !a.startsWith("--") && !a.startsWith("toolchain:") && a !== commandContext?.command);
}

const HANDLERS = {};

async function cmd_memory_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const repo = getPositionalArg(args, commandContext) || "eos-system-control-plane";
  const graph = new EosEpisodicMemoryGraph();
  const receipt = graph.audit(repo);
  const receiptPath = getReceiptPath(ROOT);

  try {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch (err) {
    console.error(`Warning: Could not persist evidence receipt: ${err.message}`);
  }

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Episodic Memory Graph & Cross-Project Experience Synapse (SPEC-369) ===");
    console.log(`Receipt ID            : ${receipt.receiptId}`);
    console.log(`Total Nodes           : ${receipt.stats.totalNodes}`);
    console.log(`Total Synaptic Edges  : ${receipt.stats.totalEdges}`);
    console.log(`Average Node Weight   : ${receipt.stats.averageWeight}`);
    console.log(`Pruned Nodes Count    : ${receipt.stats.prunedNodesCount}`);
    console.log(`Fleet Repos Covered   : ${Object.keys(receipt.stats.repoDistribution).length}`);
    console.log(`Top Episodes Loaded   : ${receipt.topEpisodes.length}`);
    console.log(`Integrity SHA-256     : ${receipt.sha256}`);
  }
}

async function cmd_memory_record(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const repo = getPositionalArg(args, commandContext) || "eos-system-control-plane";
  const symptom =
    args.find((a) => a.startsWith("--symptom="))?.split("=")[1] || "Uncaught exception during distributed consensus";
  const cause = args.find((a) => a.startsWith("--cause="))?.split("=")[1] || "Split-brain quorum calculation mismatch";
  const patch =
    args.find((a) => a.startsWith("--patch="))?.split("=")[1] ||
    "Enforce strict majority quorum (N/2 + 1) with monotonic epoch increments";

  const graph = new EosEpisodicMemoryGraph();
  const node = graph.ingestEpisode({
    repoId: repo,
    symptom,
    rootCause: cause,
    solutionPatch: patch,
  });

  if (isJson) {
    console.log(JSON.stringify(node, null, 2));
  } else {
    console.log(`[EPISODIC MEMORY] Ingested Episode:`);
    console.log(`ID         : ${node.id}`);
    console.log(`Repo       : ${node.repoId}`);
    console.log(`Symptom    : ${node.symptom}`);
    console.log(`Root Cause : ${node.rootCause}`);
    console.log(`Solution   : ${node.solutionPatch}`);
    console.log(`Weight     : ${node.weight}`);
    console.log(`Tokens     : ${node.tokens.join(", ")}`);
  }
}

async function cmd_memory_query(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const query = getPositionalArg(args, commandContext) || "timeout consensus deadlock";
  const repo = args.find((a) => a.startsWith("--repo="))?.split("=")[1];

  const graph = new EosEpisodicMemoryGraph();
  const results = graph.queryAssociative(query, repo, 3);

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`=== Associative Memory Query Results for "${query}" ===`);
    if (results.length === 0) {
      console.log("  No matching episodes found.");
    } else {
      for (const r of results) {
        console.log(
          `  * [${r.node.id}] (Similarity: ${(r.similarityScore * 100).toFixed(0)}%, Cross-Repo: ${r.crossRepoTransfer})`,
        );
        console.log(`    Repo    : ${r.node.repoId}`);
        console.log(`    Symptom : ${r.node.symptom}`);
        console.log(`    Solution: ${r.node.solutionPatch}`);
      }
    }
  }
}

async function cmd_memory_graph(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const graph = new EosEpisodicMemoryGraph();
  const nodes = graph.getNodes();
  const edges = graph.getEdges();

  const topology = {
    nodesCount: nodes.length,
    edgesCount: edges.length,
    nodes: nodes.map((n) => ({ id: n.id, repo: n.repoId, weight: n.weight })),
    edges,
  };

  if (isJson) {
    console.log(JSON.stringify(topology, null, 2));
  } else {
    console.log("=== Episodic Memory Graph Topology ===");
    console.log(`Total Nodes: ${nodes.length}`);
    console.log(`Total Edges: ${edges.length}`);
    for (const e of edges) {
      console.log(`  ${e.sourceId} --[${e.edgeType} (w=${e.weight})]--> ${e.targetId}`);
    }
  }
}

HANDLERS["toolchain:memory:audit"] = cmd_memory_audit;
HANDLERS["toolchain:memory:record"] = cmd_memory_record;
HANDLERS["toolchain:memory:query"] = cmd_memory_query;
HANDLERS["toolchain:memory:graph"] = cmd_memory_graph;

export async function handleEpisodicMemoryGraphCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:memory command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

export function registerCommands(router) {
  for (const [cmd, fn] of Object.entries(HANDLERS)) {
    router.register(cmd, fn);
  }
}

export { cmd_memory_audit, cmd_memory_record, cmd_memory_query, cmd_memory_graph };
