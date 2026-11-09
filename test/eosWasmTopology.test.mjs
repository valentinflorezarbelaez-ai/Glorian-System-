import test from "node:test";
import assert from "node:assert/strict";
import { getFleetNodes, getNodeById, calculateBlastRadius, getTopologyMetrics } from "../src/core/eosFleetTopology.ts";
import {
  estimateTokens,
  estimateTokensL0,
  compressContext,
  runBenchmark,
  analyzeTopology,
} from "../src/core/eosWasmEngine.ts";

test("SPEC-026 / BDD-058: Fleet Topology Graph Structure & Rings", () => {
  const nodes = getFleetNodes();
  assert.equal(nodes.length, 14, "Must have exactly 14 Sovereign nodes");

  const metrics = getTopologyMetrics();
  assert.equal(metrics.totalNodes, 14);
  assert.equal(metrics.ring1Count, 4, "Ring 1 must have 4 Sovereign Fleet platforms");
  assert.equal(metrics.ring2Count, 6, "Ring 2 must have 6 Core Engines");
  assert.equal(metrics.ring3Count, 4, "Ring 3 must have 4 Runtime Kernels");
  assert.ok(metrics.averageLatencyUs > 0, "Average latency must be positive");
  assert.ok(metrics.totalEdges > 10, "Must have defined dependency edges");

  // Check individual node lookups
  const aber = getNodeById("aberamentho");
  assert.ok(aber, "Must locate aberamentho");
  assert.equal(aber.tier, "Sovereign Fleet");
  assert.equal(aber.ring, 1);

  const core = getNodeById("EOS-CORE");
  assert.ok(core, "Case-insensitive lookup for eos-core must succeed");
  assert.equal(core.tier, "Core Engine");
  assert.equal(core.ring, 2);

  const wasmKernel = getNodeById("go-wasm-kernel");
  assert.ok(wasmKernel, "Must locate go-wasm-kernel");
  assert.equal(wasmKernel.tier, "Runtime Kernel");
  assert.equal(wasmKernel.ring, 3);
});

test("SPEC-026 / BDD-059: Transitive Blast Radius Calculation", () => {
  // eos-core has downstream: eos-system, aberamentho, portafolio, ptg
  const coreBlast = calculateBlastRadius("eos-core");
  assert.equal(coreBlast.nodeId, "eos-core");
  assert.ok(coreBlast.blastRadiusCount >= 4, "eos-core blast radius must contain at least 4 nodes");
  assert.ok(coreBlast.transitiveBlastRadius.includes("eos-system"));
  assert.ok(coreBlast.transitiveBlastRadius.includes("aberamentho"));
  assert.ok(coreBlast.transitiveBlastRadius.includes("portafolio"));
  assert.ok(coreBlast.transitiveBlastRadius.includes("ptg"));
  assert.ok(coreBlast.blastRadiusRatio > 0.25, "Ratio must reflect widespread impact");

  // Leaf node test
  const aberBlast = calculateBlastRadius("aberamentho");
  assert.equal(aberBlast.nodeId, "aberamentho");
  assert.ok(aberBlast.transitiveBlastRadius.includes("client-web"));

  // Non-existent node test
  const ghost = calculateBlastRadius("non-existent-node");
  assert.equal(ghost.blastRadiusCount, 0);
  assert.equal(ghost.transitiveBlastRadius.length, 0);
});

test("SPEC-026 / BDD-060: Dual-Mode Token Estimator & AST Outline Compressor", () => {
  const emptyTokens = estimateTokens("");
  assert.equal(emptyTokens, 0);

  const sampleText = "The quick brown fox jumps over the lazy dog";
  const estimated = estimateTokens(sampleText);
  assert.ok(estimated > 0);
  assert.equal(estimateTokensL0(sampleText), estimated);

  const rawCode = `
    // Sovereign Core Engine Header
    /* Multi-line documentation
       describing architectural invariants */
    function SovereignGate(token, payload) {
      // Check invariant
      if (!token) return false;
      return true;
    }
  `;

  const compressed = compressContext(rawCode, 100);
  assert.ok(!compressed.compressed.includes("// Sovereign Core Engine Header"), "Must strip single-line comments");
  assert.ok(!compressed.compressed.includes("Multi-line documentation"), "Must strip multi-line comments");
  assert.ok(compressed.compressed.includes("function SovereignGate(token, payload)"), "Must preserve signatures");
  assert.ok(compressed.savingsPct >= 30, `Expected >= 30% savings, got ${compressed.savingsPct}%`);
  assert.ok(compressed.executionNs >= 0, "Execution time must be measured");
});

test("SPEC-026 / BDD-060: In-Memory Zero-Allocation Engine Benchmark", () => {
  const bench = runBenchmark(50000);
  assert.equal(bench.iterations, 50000);
  assert.ok(bench.tokensAcc > 0);
  assert.ok(bench.elapsedMs >= 0);
  assert.ok(bench.tokensPerSec > 1000000, `Expected > 1M tokens/sec, got ${bench.tokensPerSec}`);
  assert.ok(bench.engine.length > 0);
});

test("SPEC-026: Topology Analysis Bridge Delegator", () => {
  const analysis = analyzeTopology("disruptor-ring");
  assert.equal(analysis.nodeId, "disruptor-ring");
  assert.ok(analysis.directDownstream.includes("eos-core"));
  assert.ok(analysis.transitiveBlastRadius.includes("eos-system"));
});
