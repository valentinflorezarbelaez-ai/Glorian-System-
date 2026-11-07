import test from "node:test";
import assert from "node:assert/strict";

import { EosHnswVectorEngine } from "../src/core/eosHnswVectorEngine.ts";
import { EosMonteCarloEngine } from "../src/core/eosMonteCarloEngine.ts";
import { EosMonotonicHashChain, GENESIS_PREVIOUS_HASH } from "../src/core/eosMonotonicHashChain.ts";

test("EosHnswVectorEngine — Pure Layer-0 Distance Metrics", () => {
  const cosineEngine = new EosHnswVectorEngine({ dimensions: 4, metric: "cosine" });
  const euclideanEngine = new EosHnswVectorEngine({ dimensions: 4, metric: "euclidean" });

  const v1 = new Float32Array([1, 0, 0, 0]);
  const v2 = new Float32Array([1, 0, 0, 0]);
  const v3 = new Float32Array([0, 1, 0, 0]);

  // Identical vectors: distance should be 0
  assert.equal(cosineEngine.computeDistance(v1, v2), 0);
  assert.equal(euclideanEngine.computeDistance(v1, v2), 0);

  // Orthogonal vectors: cosine distance should be 1.0
  assert.equal(cosineEngine.computeDistance(v1, v3), 1.0);
  // Euclidean distance should be sqrt(1^2 + (-1)^2) = sqrt(2)
  assert.ok(Math.abs(euclideanEngine.computeDistance(v1, v3) - Math.SQRT2) < 1e-5);
});

test("EosHnswVectorEngine — Deterministic Text Projection", () => {
  const text1 = "Palantir semantic ontology graph";
  const text2 = "Palantir semantic ontology graph";
  const text3 = "SpaceX Starship orbital trajectory";

  const vec1 = EosHnswVectorEngine.projectTextToVector(text1, 64);
  const vec2 = EosHnswVectorEngine.projectTextToVector(text2, 64);
  const vec3 = EosHnswVectorEngine.projectTextToVector(text3, 64);

  assert.equal(vec1.length, 64);
  assert.deepEqual(vec1, vec2, "Projection must be 100% deterministic");

  // Verify L2 unit normalization (norm approx 1.0)
  let normSq = 0;
  for (let i = 0; i < vec1.length; i++) {
    normSq += vec1[i] * vec1[i];
  }
  assert.ok(Math.abs(Math.sqrt(normSq) - 1.0) < 1e-5, "Projected vector must be unit-normalized");

  // Cosine similarity between text1 and text2 must be 1.0, and distinct from text3
  const engine = new EosHnswVectorEngine({ dimensions: 64 });
  const distSame = engine.computeDistance(vec1, vec2);
  const distDiff = engine.computeDistance(vec1, vec3);
  assert.equal(distSame, 0);
  assert.ok(distDiff > 0.1, "Distinct concepts must have positive distance");
});

test("EosHnswVectorEngine — Multi-layer Graph Insertion and k-NN Search", () => {
  const engine = new EosHnswVectorEngine({ dimensions: 16, m: 8, efConstruction: 32, efSearch: 16 });

  // Index 30 structured vectors
  for (let i = 0; i < 30; i++) {
    const vec = new Float32Array(16);
    vec[i % 16] = 1.0;
    vec[(i + 1) % 16] = 0.5;
    engine.addPoint(`doc-${i}`, vec, { index: i });
  }

  const stats = engine.getStats();
  assert.equal(stats.totalNodes, 30);
  assert.equal(stats.dimensions, 16);
  assert.ok(stats.maxLevel >= 0);

  // Query vector matching doc-0
  const query = new Float32Array(16);
  query[0] = 1.0;
  query[1] = 0.5;

  const results = engine.searchKnn(query, 5);
  assert.ok(results.length > 0);
  assert.equal(results[0].id, "doc-0");
  assert.equal(results[0].distance, 0);
  assert.equal(results[0].similarity, 1.0);

  // Invariant: distances must be monotonically non-decreasing
  for (let j = 1; j < results.length; j++) {
    assert.ok(results[j].distance >= results[j - 1].distance);
  }
});

test("EosHnswVectorEngine — Text Document Indexing & Semantic Search", () => {
  const engine = new EosHnswVectorEngine({ dimensions: 64 });

  engine.addDocument("doc-crypto", "NSA cryptographic hash suite with post-quantum security");
  engine.addDocument("doc-risk", "BlackRock Aladdin stochastic Monte Carlo simulation");
  engine.addDocument("doc-sat", "SpaceX Starlink orbital satellite telemetry network");
  engine.addDocument("doc-vector", "Palantir HNSW vector index multi-layer small world");

  const results = engine.searchByText("Palantir vector search HNSW", 2);
  assert.ok(results.length >= 1);
  assert.equal(results[0].id, "doc-vector", "Nearest document must be the vector doc");
});

test("EosMonteCarloEngine — Beta-PERT Stochastic Simulation & Percentiles", () => {
  const tasks = [
    { id: "T1", name: "Vector Index", optimistic: 2, nominal: 4, pessimistic: 8 },
    { id: "T2", name: "Monte Carlo", optimistic: 1, nominal: 3, pessimistic: 6 },
    { id: "T3", name: "Hash Chain", optimistic: 3, nominal: 5, pessimistic: 10 },
  ];

  const result = EosMonteCarloEngine.simulate(tasks, {
    iterations: 5000,
    seed: 42,
    deadlineHours: 15,
  });

  assert.equal(result.summary.iterations, 5000);
  assert.ok(result.summary.mean > 6 && result.summary.mean < 24);
  assert.ok(result.summary.standardDeviation > 0);

  const { p10, p50, p80, p90, p95, p99 } = result.percentiles;

  // Invariant: Percentile distribution monotonic hierarchy
  assert.ok(p10 <= p50, `p10 (${p10}) <= p50 (${p50})`);
  assert.ok(p50 <= p80, `p50 (${p50}) <= p80 (${p80})`);
  assert.ok(p80 <= p90, `p80 (${p80}) <= p90 (${p90})`);
  assert.ok(p90 <= p95, `p90 (${p95}) <= p95 (${p95})`);
  assert.ok(p95 <= p99, `p95 (${p95}) <= p99 (${p99})`);

  assert.ok(typeof result.summary.deadlineProbability === "number");
  assert.ok(result.summary.deadlineProbability >= 0 && result.summary.deadlineProbability <= 100);
});

test("EosMonotonicHashChain — Monotonicity, SHA-256 Ledger & Tamper Proofing", () => {
  const chain = new EosMonotonicHashChain();

  const b0 = chain.append("REC-001", "AUTH", "Genesis authorization");
  assert.equal(b0.index, 0);
  assert.equal(b0.previousHash, GENESIS_PREVIOUS_HASH);

  const b1 = chain.append("REC-002", "AUDIT", "Security audit clean");
  assert.equal(b1.index, 1);
  assert.equal(b1.previousHash, b0.currentHash);
  assert.ok(b1.monotonicNs >= b0.monotonicNs);

  const b2 = chain.append("REC-003", "DEPLOY", "Production Vercel deployment");
  assert.equal(b2.index, 2);
  assert.equal(b2.previousHash, b1.currentHash);
  assert.ok(b2.monotonicNs >= b1.monotonicNs);

  // Initial verification must be valid
  const verifyResult = chain.verify();
  assert.equal(verifyResult.valid, true);
  assert.equal(verifyResult.totalBlocks, 3);

  // Serialization / Deserialization round-trip
  const json = chain.toJSON();
  const recoveredChain = new EosMonotonicHashChain();
  recoveredChain.loadFromJSON(json);
  assert.equal(recoveredChain.verify().valid, true);
  assert.equal(recoveredChain.getBlocks().length, 3);

  // Tamper detection test: mutate payload of block 1
  const tamperedJson = JSON.parse(JSON.stringify(json));
  tamperedJson[1].payload.summary = "TAMPERED EVIDENCE";

  const tamperedChain = new EosMonotonicHashChain();
  tamperedChain.loadFromJSON(tamperedJson);
  const tamperedVerify = tamperedChain.verify();
  assert.equal(tamperedVerify.valid, false);
  assert.equal(tamperedVerify.brokenIndex, 1);
  assert.ok(tamperedVerify.reason.includes("BROKEN_CHAIN_DETECTED"));
});
