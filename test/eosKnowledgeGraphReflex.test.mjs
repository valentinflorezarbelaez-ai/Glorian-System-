/**
 * @file eosKnowledgeGraphReflex.test.mjs
 * @description Automated test suite for SPEC-345 / CHANGE-207 (BDD-1849..BDD-1854).
 * Verifies bitemporal property graph, Tarjan SCC cycle detection, Kahn DAG topological sorting,
 * deterministic blast radius computation, bounded reactive reflex cascades, PageRank centrality,
 * CLI dispatch, and Phase 8 MCP tool integration.
 *
 * Invariant: Pure Layer-0 testing, zero external runtime dependencies, hermetic receipts.
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  auditKnowledgeGraphReflex,
  createKnowledgeGraph,
  MAX_REFLEX_CASCADE_DEPTH,
} from "../src/core/eosKnowledgeGraphReflex.ts";
import { handleKnowledgeGraphCommand } from "../bin/commands/cliKnowledgeGraphReflex.mjs";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

test("SPEC-345 / BDD-1849: Bitemporal Property Graph Entity and Edge Creation", () => {
  const kg = createKnowledgeGraph();

  kg.addNode({
    id: "SPEC-345",
    type: "SPECIFICATION",
    label: "Knowledge Graph Specification",
    properties: { author: "Valentin" },
  });

  kg.addNode({
    id: "INV-01",
    type: "INVARIANT",
    label: "Cycle-Free DAG Invariant",
  });

  kg.addEdge({
    id: "E-SPEC-INV",
    source: "SPEC-345",
    target: "INV-01",
    type: "PRESERVES",
  });

  const state = kg.getState();
  assert.equal(state.nodes.size, 2);
  assert.equal(state.edges.size, 1);
  assert.equal(state.txSequence, 3); // 2 nodes + 1 edge
  assert.ok(state.stateHash.length === 64);

  const node = kg.getNode("SPEC-345");
  assert.ok(node);
  assert.equal(node.label, "Knowledge Graph Specification");
  assert.equal(node.type, "SPECIFICATION");

  // Attempting to add an edge with nonexistent endpoints must throw
  assert.throws(() => {
    kg.addEdge({
      id: "E-INVALID",
      source: "NONEXISTENT_A",
      target: "NONEXISTENT_B",
      type: "DEPENDS_ON",
    });
  });

  // Remove edge and node
  const edgeRemoved = kg.removeEdge("E-SPEC-INV");
  assert.ok(edgeRemoved);
  assert.equal(kg.listEdges().length, 0);

  const nodeRemoved = kg.removeNode("INV-01");
  assert.ok(nodeRemoved);
  assert.equal(kg.listNodes().length, 1);
});

test("SPEC-345 / BDD-1850: Cycle Detection via Tarjan's Strongly Connected Components", () => {
  const kgAcyclic = createKnowledgeGraph();
  kgAcyclic.addNode({ id: "N1", type: "CONCEPT", label: "Node 1" });
  kgAcyclic.addNode({ id: "N2", type: "CONCEPT", label: "Node 2" });
  kgAcyclic.addNode({ id: "N3", type: "CONCEPT", label: "Node 3" });
  kgAcyclic.addEdge({ id: "E12", source: "N1", target: "N2", type: "DEPENDS_ON" });
  kgAcyclic.addEdge({ id: "E23", source: "N2", target: "N3", type: "DEPENDS_ON" });

  const cleanReport = kgAcyclic.findCycles();
  assert.equal(cleanReport.hasCycles, false);
  assert.equal(cleanReport.cycleCount, 0);
  assert.equal(cleanReport.cycles.length, 0);

  // Cyclic Graph: N1 -> N2 -> N3 -> N1
  const kgCyclic = createKnowledgeGraph();
  kgCyclic.addNode({ id: "N1", type: "CONCEPT", label: "Node 1" });
  kgCyclic.addNode({ id: "N2", type: "CONCEPT", label: "Node 2" });
  kgCyclic.addNode({ id: "N3", type: "CONCEPT", label: "Node 3" });
  kgCyclic.addEdge({ id: "E12", source: "N1", target: "N2", type: "DEPENDS_ON" });
  kgCyclic.addEdge({ id: "E23", source: "N2", target: "N3", type: "DEPENDS_ON" });
  kgCyclic.addEdge({ id: "E31", source: "N3", target: "N1", type: "DEPENDS_ON" });

  const cyclicReport = kgCyclic.findCycles();
  assert.equal(cyclicReport.hasCycles, true);
  assert.equal(cyclicReport.cycleCount, 1);
  assert.equal(cyclicReport.cycles[0].length, 3);
  assert.ok(cyclicReport.cycles[0].includes("N1"));
  assert.ok(cyclicReport.cycles[0].includes("N2"));
  assert.ok(cyclicReport.cycles[0].includes("N3"));

  // Self-loop: N1 -> N1
  const kgSelf = createKnowledgeGraph();
  kgSelf.addNode({ id: "SELF", type: "CONCEPT", label: "Self Loop" });
  kgSelf.addEdge({ id: "E-SELF", source: "SELF", target: "SELF", type: "DEPENDS_ON" });
  const selfReport = kgSelf.findCycles();
  assert.equal(selfReport.hasCycles, true);
  assert.equal(selfReport.cycles[0][0], "SELF");
});

test("SPEC-345 / BDD-1851: Kahn's Topological Sorting of Architectural DAGs", () => {
  const kg = createKnowledgeGraph();
  // Build DAG: Task A -> Task B -> Task D; Task A -> Task C -> Task D
  kg.addNode({ id: "A", type: "CONCEPT", label: "Start A" });
  kg.addNode({ id: "B", type: "CONCEPT", label: "Middle B" });
  kg.addNode({ id: "C", type: "CONCEPT", label: "Middle C" });
  kg.addNode({ id: "D", type: "CONCEPT", label: "End D" });

  kg.addEdge({ id: "E-AB", source: "A", target: "B", type: "DEPENDS_ON" });
  kg.addEdge({ id: "E-AC", source: "A", target: "C", type: "DEPENDS_ON" });
  kg.addEdge({ id: "E-BD", source: "B", target: "D", type: "DEPENDS_ON" });
  kg.addEdge({ id: "E-CD", source: "C", target: "D", type: "DEPENDS_ON" });

  const topo = kg.topologicalSort();
  assert.equal(topo.isDag, true);
  assert.equal(topo.orderedNodeIds.length, 4);
  assert.equal(topo.unresolvedCount, 0);

  // In any valid topological sort, A must precede B and C, and B/C must precede D
  const idxA = topo.orderedNodeIds.indexOf("A");
  const idxB = topo.orderedNodeIds.indexOf("B");
  const idxC = topo.orderedNodeIds.indexOf("C");
  const idxD = topo.orderedNodeIds.indexOf("D");

  assert.ok(idxA < idxB);
  assert.ok(idxA < idxC);
  assert.ok(idxB < idxD);
  assert.ok(idxC < idxD);

  // Add cycle and verify topological sort detects non-DAG
  kg.addEdge({ id: "E-DA", source: "D", target: "A", type: "DEPENDS_ON" });
  const topoCyclic = kg.topologicalSort();
  assert.equal(topoCyclic.isDag, false);
  assert.ok(topoCyclic.unresolvedCount > 0);
});

test("SPEC-345 / BDD-1852: Deterministic Blast Radius Computation", () => {
  const kg = createKnowledgeGraph();
  // Root -> L1_A -> L2_A
  //      -> L1_B
  kg.addNode({ id: "ROOT", type: "SPECIFICATION", label: "Root Spec" });
  kg.addNode({ id: "L1_A", type: "FILE", label: "File 1A" });
  kg.addNode({ id: "L1_B", type: "FILE", label: "File 1B" });
  kg.addNode({ id: "L2_A", type: "FLEET_REPO", label: "Fleet Repo" });

  kg.addEdge({ id: "E1", source: "ROOT", target: "L1_A", type: "GOVERNS" });
  kg.addEdge({ id: "E2", source: "ROOT", target: "L1_B", type: "GOVERNS" });
  kg.addEdge({ id: "E3", source: "L1_A", target: "L2_A", type: "DEPENDS_ON" });

  // Downstream blast radius from ROOT
  const blastDown = kg.computeBlastRadius("ROOT", { maxDepth: 2, direction: "DOWNSTREAM" });
  assert.equal(blastDown.rootId, "ROOT");
  assert.equal(blastDown.impactedNodes.length, 3);
  assert.ok(blastDown.severityScore > 0);

  const l1a = blastDown.impactedNodes.find((n) => n.id === "L1_A");
  assert.ok(l1a);
  assert.equal(l1a.depth, 1);
  assert.deepEqual(l1a.path, ["ROOT", "L1_A"]);

  const l2a = blastDown.impactedNodes.find((n) => n.id === "L2_A");
  assert.ok(l2a);
  assert.equal(l2a.depth, 2);
  assert.deepEqual(l2a.path, ["ROOT", "L1_A", "L2_A"]);

  // Upstream blast radius from L2_A
  const blastUp = kg.computeBlastRadius("L2_A", { maxDepth: 2, direction: "UPSTREAM" });
  assert.equal(blastUp.rootId, "L2_A");
  assert.equal(blastUp.impactedNodes.length, 2); // L1_A, ROOT
  assert.ok(blastUp.impactedNodes.some((n) => n.id === "L1_A"));
  assert.ok(blastUp.impactedNodes.some((n) => n.id === "ROOT"));
});

test("SPEC-345 / BDD-1853: Bounded Reactive Reflex Dispatch Cascade", () => {
  const kg = createKnowledgeGraph();
  kg.addNode({ id: "TARGET", type: "FILE", label: "Target Module" });

  let recursiveCallCount = 0;
  kg.registerReflexHook("NODE_UPDATED", (ev) => {
    recursiveCallCount++;
    return [
      {
        id: `act-${recursiveCallCount}`,
        triggerEntityId: ev.triggerEntityId,
        eventType: "NODE_UPDATED",
        actionType: "INVALIDATE_CACHE",
        actionPayload: { count: recursiveCallCount },
        depth: ev.depth ?? 0,
      },
    ];
  });

  const actions = kg.dispatchReflex({
    triggerEntityId: "TARGET",
    eventType: "NODE_UPDATED",
    depth: 0,
    lineage: ["TARGET"],
  });

  // Verify that recursion was bounded and did not exceed MAX_REFLEX_CASCADE_DEPTH (10)
  assert.ok(actions.length > 0);
  assert.ok(recursiveCallCount <= MAX_REFLEX_CASCADE_DEPTH + 1);
  const haltAction = actions.find((a) => a.actionPayload.reason === "MAX_REFLEX_CASCADE_DEPTH_REACHED");
  assert.ok(haltAction);
  assert.equal(haltAction.actionType, "AUDIT_ALERT");
  assert.equal(haltAction.depth, MAX_REFLEX_CASCADE_DEPTH);
});

test("SPEC-345 / BDD-1854: PageRank Centrality, Audit Receipt, CLI & MCP Tool Invocation", async () => {
  const kg = createKnowledgeGraph();
  kg.addNode({ id: "HUB", type: "SPECIFICATION", label: "Central Architecture Hub" });
  kg.addNode({ id: "LEAF_1", type: "FILE", label: "Leaf 1" });
  kg.addNode({ id: "LEAF_2", type: "FILE", label: "Leaf 2" });
  kg.addNode({ id: "LEAF_3", type: "FILE", label: "Leaf 3" });

  // Inward edges to HUB make HUB the most central node
  kg.addEdge({ id: "E1", source: "LEAF_1", target: "HUB", type: "DEPENDS_ON" });
  kg.addEdge({ id: "E2", source: "LEAF_2", target: "HUB", type: "DEPENDS_ON" });
  kg.addEdge({ id: "E3", source: "LEAF_3", target: "HUB", type: "DEPENDS_ON" });

  const pageRank = kg.computePageRank();
  assert.ok(pageRank.iterations > 0);
  assert.ok(pageRank.ranks["HUB"] > pageRank.ranks["LEAF_1"]);
  assert.ok(pageRank.ranks["HUB"] > pageRank.ranks["LEAF_2"]);

  // 1. Audit receipt emission
  const receipt = auditKnowledgeGraphReflex(ROOT);
  assert.equal(receipt.spec, "SPEC-345");
  assert.equal(receipt.allPassed, true);
  assert.equal(receipt.cyclesDetected, true);
  assert.equal(receipt.topologicalSortValid, true);
  assert.equal(receipt.blastRadiusVerified, true);
  assert.equal(receipt.reflexCascadeBounded, true);
  assert.ok(receipt.sha256.length === 64);

  // 2. CLI Dispatch execution
  const cliExecuted = await handleKnowledgeGraphCommand({
    command: "toolchain:graph:audit",
    args: ["--json"],
  });
  assert.equal(cliExecuted, true);

  const cliCycles = await handleKnowledgeGraphCommand({
    command: "toolchain:graph:cycles",
    args: ["--json"],
  });
  assert.equal(cliCycles, true);

  // 3. Phase 8 MCP Tool Execution
  const handlers = createPhase8AgiHandlers({ projectRoot: ROOT });
  assert.ok(typeof handlers.eos_knowledge_graph_reflex_audit === "function");
  const mcpReceipt = await handlers.eos_knowledge_graph_reflex_audit({});
  assert.equal(mcpReceipt.spec, "SPEC-345");
  assert.equal(mcpReceipt.allPassed, true);
});
