/**
 * EOS Sovereign Control Plane — Layer-0 Pure ESM Test
 * Test Suite: Episodic Memory Graph & Cross-Project Experience Synapse (SPEC-369 / CHANGE-231)
 * Scenarios: BDD-1993 through BDD-1998
 * Invariant: Zero external dependencies, pure node:test and node:assert.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosEpisodicMemoryGraph, FLEET_REPOSITORIES } from "../src/core/eosEpisodicMemoryGraph.ts";

test("BDD-1993: Structured Ingestion of Problem-Solving Episodes", () => {
  const graph = new EosEpisodicMemoryGraph();
  const episode = graph.ingestEpisode({
    repoId: "donaciones",
    symptom: "Postgres connection pool exhausted under high concurrent traffic",
    rootCause: "Missing connection release in error recovery handler",
    solutionPatch: "Wrap client in try-finally and return to pool deterministically",
    pinned: false,
  });

  assert.ok(episode.id.startsWith("EP-"));
  assert.strictEqual(episode.repoId, "donaciones");
  assert.ok(episode.tokens.length > 0);
  assert.strictEqual(episode.weight, 1.0);
  assert.strictEqual(episode.accessCount, 0);
  assert.strictEqual(episode.verificationReceipt.length, 64);
  assert.ok(episode.createdAt > 0);
});

test("BDD-1994: Associative Cross-Project Retrieval across Fleet", () => {
  const graph = new EosEpisodicMemoryGraph();

  // Query across fleet repos with abstract error pattern
  const results = graph.queryAssociative("TLC timeout budget during model checking", "crud-slack", 3);

  assert.ok(results.length > 0);
  const top = results[0];
  assert.ok(top.similarityScore > 0);
  assert.strictEqual(top.crossRepoTransfer, true); // learned from eos-system, queried from crud-slack
  assert.ok(top.node.symptom.includes("TLC"));
  assert.ok(top.node.weight > 1.0); // reinforced on retrieval
});

test("BDD-1995: Dynamic Synaptic Edge Construction and Causal Traversal", () => {
  const graph = new EosEpisodicMemoryGraph();

  // Ingest related episodes
  const ep1 = graph.ingestEpisode({
    repoId: "control-de-asistencia-abopack",
    symptom: "Memory leak detected in streaming worker process",
    rootCause: "Unbounded event listener accumulation on websocket connection",
    solutionPatch: "Implement weak references and cleanup handlers on socket close",
  });

  const ep2 = graph.ingestEpisode({
    repoId: "performance-talent-group",
    symptom: "Worker process crash on streaming websocket",
    rootCause: "Unbounded event listener accumulation on websocket connection",
    solutionPatch: "Implement weak references and cleanup handlers on socket close",
  });

  const edges = graph.getEdges();
  const connectingEdge = edges.find(
    (e) => (e.sourceId === ep1.id && e.targetId === ep2.id) || (e.sourceId === ep2.id && e.targetId === ep1.id),
  );

  assert.ok(connectingEdge);
  assert.ok(connectingEdge.confidence > 0);

  const traversal = graph.getCausalPath(ep1.id, 3);
  assert.strictEqual(traversal.originId, ep1.id);
  assert.ok(traversal.path.length >= 1);
});

test("BDD-1996: Temporal Ebbinghaus Decay and Recall Reinforcement", () => {
  const graph = new EosEpisodicMemoryGraph();
  const ep = graph.ingestEpisode({
    repoId: "aberamentho",
    symptom: "Cold start initialization delay",
    rootCause: "Synchronous asset decompression on main thread",
    solutionPatch: "Defer asset loading to background worker thread",
    pinned: false,
  });

  const initialWeight = ep.weight;
  assert.strictEqual(initialWeight, 1.0);

  // Apply decay
  graph.applyTemporalDecay(0.3);
  assert.strictEqual(ep.weight, 0.7);

  // Retrieve and reinforce
  graph.queryAssociative("decompression main thread", "aberamentho", 1);
  assert.ok(ep.weight > 0.7);
  assert.strictEqual(ep.accessCount, 1);
});

test("BDD-1997: Bounded Capacity and Safe Topological Pruning", () => {
  const capacity = 5;
  const graph = new EosEpisodicMemoryGraph(capacity);

  // Ingest episodes to exceed capacity
  for (let i = 0; i < 6; i++) {
    graph.ingestEpisode({
      repoId: "atp-strength",
      symptom: `Synthetic stress symptom token-${i}`,
      rootCause: `Root cause issue-${i}`,
      solutionPatch: `Solution patch fix-${i}`,
      pinned: false,
    });
  }

  const stats = graph.getStats();
  assert.ok(stats.totalNodes <= capacity);
  assert.ok(stats.prunedNodesCount > 0);

  // Check graph integrity: no dangling edges
  const nodes = graph.getNodes();
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of graph.getEdges()) {
    assert.ok(nodeIds.has(edge.sourceId));
    assert.ok(nodeIds.has(edge.targetId));
  }
});

test("BDD-1998: Full Diagnostic Audit and Memory Synapse Receipt", () => {
  const graph = new EosEpisodicMemoryGraph();
  const receipt = graph.audit("eos-system-control-plane");

  assert.ok(receipt.receiptId.startsWith("RCP-MEMSYNAPSE-"));
  assert.strictEqual(receipt.sha256.length, 64);
  assert.ok(receipt.stats.totalNodes >= 3);
  assert.ok(receipt.topEpisodes.length >= 3);
  assert.ok(new Date(receipt.generatedAt).getTime() > 0);

  for (const repo of Object.keys(receipt.stats.repoDistribution)) {
    assert.ok(FLEET_REPOSITORIES.includes(repo));
  }
});
