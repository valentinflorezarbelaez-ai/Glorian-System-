/**
 * @file eosArchitecturalCanvas.test.mjs
 * @description Automated test suite for SPEC-358 / CHANGE-220: Live Self-Introspecting Architectural Canvas & Bi-Directional Interactive Topology Engine.
 *
 * Verifies BDD-1927 through BDD-1932:
 * - BDD-1927: Introspección y Cosecha Automática del Grafo Arquitectónico
 * - BDD-1928: Algoritmo de Layout Jerárquico Sugiyama en Capa 0
 * - BDD-1929: Detección de Ciclos y Rechazo Fail-Closed de Mutaciones Inválidas
 * - BDD-1930: Cálculo Determinista del Radio de Impacto Causal (Blast Radius)
 * - BDD-1931: Renderizado Vectorial SVG Puro con Tokens Tier S-0
 * - BDD-1932: Benchmark de Rendimiento Topológico y Recibo Formal de Auditoría
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  EosArchitecturalCanvasCore,
  EosCanvasLayoutEngine,
  EosCanvasSvgRenderer,
  EosInteractiveTopologyManager,
  EosTopologyHarvester,
} from "../src/core/eosArchitecturalCanvas.ts";

test("BDD-1927: Introspección y Cosecha Automática del Grafo Arquitectónico", () => {
  const { nodes, edges } = EosTopologyHarvester.harvest(process.cwd());

  assert.ok(nodes.length > 10, "Should discover multiple architectural nodes");
  assert.ok(edges.length > 5, "Should harvest architectural dependencies");

  const coreNode = nodes.find((n) => n.id === "eos-system");
  assert.ok(coreNode, "Root control plane node must exist");
  assert.equal(coreNode?.type, "CORE_MODULE");

  const openspecNodes = nodes.filter((n) => n.type === "OPENSPEC");
  assert.ok(openspecNodes.length > 0, "Should harvest OpenSpec nodes");

  const tlaNodes = nodes.filter((n) => n.type === "TLA_MODEL");
  assert.ok(tlaNodes.length > 0, "Should harvest TLA+ formal model nodes");
});

test("BDD-1928: Algoritmo de Layout Jerárquico Sugiyama en Capa 0", () => {
  const nodes = [
    { id: "A", label: "A", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
    { id: "B", label: "B", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
    { id: "C", label: "C", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
  ];
  const edges = [
    { id: "e1", source: "A", target: "B", type: "DEPENDS_ON" },
    { id: "e2", source: "B", target: "C", type: "DEPENDS_ON" },
  ];

  const topology = EosCanvasLayoutEngine.layout(nodes, edges);

  assert.equal(topology.totalLayers, 3);
  const nodeA = topology.nodes.find((n) => n.id === "A");
  const nodeB = topology.nodes.find((n) => n.id === "B");
  const nodeC = topology.nodes.find((n) => n.id === "C");

  assert.equal(nodeA?.layer, 0);
  assert.equal(nodeB?.layer, 1);
  assert.equal(nodeC?.layer, 2);

  assert.ok((nodeA?.y ?? 0) < (nodeB?.y ?? 0));
  assert.ok((nodeB?.y ?? 0) < (nodeC?.y ?? 0));
});

test("BDD-1929: Detección de Ciclos y Rechazo Fail-Closed de Mutaciones Inválidas", () => {
  const nodes = [
    { id: "X", label: "X", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
    { id: "Y", label: "Y", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
    { id: "Z", label: "Z", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
  ];

  const manager = new EosInteractiveTopologyManager(nodes, []);

  // Legal acyclic path X -> Y -> Z
  manager.addEdge({ id: "eXY", source: "X", target: "Y", type: "DEPENDS_ON" });
  manager.addEdge({ id: "eYZ", source: "Y", target: "Z", type: "DEPENDS_ON" });
  assert.equal(manager.getEdges().length, 2);

  // Self loop rejection
  assert.throws(
    () => manager.addEdge({ id: "eXX", source: "X", target: "X", type: "DEPENDS_ON" }),
    /CYCLE_DETECTED: Self-loop detected/,
  );

  // Circular dependency Z -> X rejection
  assert.throws(
    () => manager.addEdge({ id: "eZX", source: "Z", target: "X", type: "DEPENDS_ON" }),
    /CYCLE_DETECTED: Adding edge 'Z' -> 'X' introduces circular dependency/,
  );

  // Edges count remained 2 (atomic fail-closed)
  assert.equal(manager.getEdges().length, 2);
});

test("BDD-1930: Cálculo Determinista del Radio de Impacto Causal (Blast Radius)", () => {
  const nodes = [
    { id: "root", label: "root", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
    { id: "mid1", label: "mid1", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
    { id: "mid2", label: "mid2", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
    { id: "leaf", label: "leaf", type: "CORE_MODULE", layer: 0, x: 0, y: 0, width: 180, height: 60, metadata: {} },
  ];
  const edges = [
    { id: "e1", source: "root", target: "mid1", type: "DEPENDS_ON" },
    { id: "e2", source: "root", target: "mid2", type: "DEPENDS_ON" },
    { id: "e3", source: "mid1", target: "leaf", type: "DEPENDS_ON" },
  ];

  const manager = new EosInteractiveTopologyManager(nodes, edges);

  const blastMid1 = manager.calculateBlastRadius("mid1");
  assert.equal(blastMid1.targetNodeId, "mid1");
  assert.ok(blastMid1.upstreamImpacted.includes("root"));
  assert.ok(blastMid1.downstreamDependencies.includes("leaf"));
  assert.equal(blastMid1.totalImpactedCount, 2);

  const blastRoot = manager.calculateBlastRadius("root");
  assert.equal(blastRoot.upstreamImpacted.length, 0);
  assert.equal(blastRoot.downstreamDependencies.length, 3);
});

test("BDD-1931: Renderizado Vectorial SVG Puro con Tokens Tier S-0", () => {
  const nodes = [
    { id: "n1", label: "Kernel", type: "CORE_MODULE", layer: 0, x: 60, y: 60, width: 180, height: 60, metadata: {} },
    { id: "n2", label: "Spec", type: "OPENSPEC", layer: 1, x: 60, y: 200, width: 180, height: 60, metadata: {} },
  ];
  const edges = [{ id: "e1", source: "n1", target: "n2", type: "SPECIFIES" }];

  const topology = EosCanvasLayoutEngine.layout(nodes, edges);
  const svg = EosCanvasSvgRenderer.render(topology);

  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(svg.includes("<svg"));
  assert.ok(svg.includes("GLORIAN ARCHITECTURAL CANVAS (SPEC-358)"));
  assert.ok(svg.includes("#00f0ff")); // Cyan neon accent token
  assert.ok(svg.includes("Kernel"));
  assert.ok(svg.includes("</svg>"));
});

test("BDD-1932: Benchmark de Rendimiento Topológico y Recibo Formal de Auditoría", () => {
  const bench = EosArchitecturalCanvasCore.runBenchmark(500);

  assert.equal(bench.nodeCount, 500);
  assert.ok(bench.layoutDurationUs > 0);
  assert.ok(bench.blastRadiusDurationUs > 0);
  assert.ok(bench.svgRenderDurationUs > 0);

  const receipt = EosArchitecturalCanvasCore.audit(process.cwd());
  assert.equal(receipt.specId, "SPEC-358");
  assert.equal(receipt.changeId, "CHANGE-220");
  assert.equal(receipt.verdict, "CONFORMANT");
  assert.equal(receipt.tlcModelVerified, true);
  assert.equal(receipt.epistemicState, "PRODUCTION_READY_WITHIN_TESTED_SCOPE");

  const receiptPath = resolveEvidencePath("ARCHITECTURAL_CANVAS_RECEIPT.json", process.cwd());
  assert.ok(fs.existsSync(receiptPath));
});
