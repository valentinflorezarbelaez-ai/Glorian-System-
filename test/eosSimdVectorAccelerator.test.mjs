/**
 * EOS SYSTEM — SPEC-074 BDD TEST SUITE
 * Hardware-Accelerated Vector Algebra Engine (SIMD / Float32 Aligned)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosSimdVectorAccelerator } from '../src/core/eosSimdVectorAccelerator.ts';

test('BDD-223: High-Dimensional Cosine Similarity and L2 Normalization Invariant', () => {
  const dim = 1536;
  const v1 = new Float32Array(dim);
  const v2 = new Float32Array(dim);

  // Identical direction, differing magnitudes
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(i * 0.05);
    v1[i] = val * 2.5;
    v2[i] = val * 10.0;
  }

  const start = performance.now();
  const sim = EosSimdVectorAccelerator.cosineSimilarity(v1, v2);
  const durationMs = performance.now() - start;

  // Cosine similarity of identical directions must equal 1.0 (within float32 precision)
  assert.ok(Math.abs(sim - 1.0) < 1e-5, `Expected ~1.0, got ${sim}`);
  assert.ok(durationMs < 500.0, `Duration ${durationMs}ms should be under 500ms`);

  // L2 normalization test
  const norm1 = EosSimdVectorAccelerator.normalize(v1);
  const l2 = EosSimdVectorAccelerator.l2Norm(norm1);
  assert.ok(Math.abs(l2 - 1.0) < 1e-5, `Normalized L2 norm should be 1.0, got ${l2}`);
});

test('BDD-224: Batch Top-K Nearest Neighbor Sweep with Zero Allocations', () => {
  const dim = 768;
  const numCandidates = 100;
  const candidates = [];

  for (let c = 0; c < numCandidates; c++) {
    const vec = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      vec[i] = Math.cos(c * 0.1 + i * 0.02);
    }
    candidates.push(vec);
  }

  // Query is identical to candidate index 42
  const query = new Float32Array(candidates[42]);

  const top3 = EosSimdVectorAccelerator.topK(query, candidates, 3);
  assert.equal(top3.length, 3);
  assert.equal(top3[0].index, 42);
  assert.ok(Math.abs(top3[0].score - 1.0) < 1e-5, `Top score must be ~1.0, got ${top3[0].score}`);
  assert.ok(top3[0].score >= top3[1].score);
  assert.ok(top3[1].score >= top3[2].score);

  // Benchmark method
  const accelerator = new EosSimdVectorAccelerator();
  const bench = accelerator.benchmark(128, 500);
  assert.equal(bench.operationsCount, 500);
  assert.equal(bench.receiptSha256.length, 64);
});
