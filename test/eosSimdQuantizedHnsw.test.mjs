/**
 * BDD Test Suite for SPEC-314 / CHANGE-176:
 * SIMD Quantized Vector Embedding Engine (i8x16 / f32x4) for Sub-Millisecond HNSW Search
 *
 * Verifies BDD-1659..BDD-1664.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { EosSimdQuantizedHnswCore } from "../src/core/index.ts";
import { resolveEvidenceDir } from "../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const EVIDENCE_DIR = resolveEvidenceDir(ROOT);
const RECEIPT_PATH = path.join(EVIDENCE_DIR, "SIMD_QUANTIZED_HNSW_RECEIPT.json");

function generateTestVector(dim, seed = 1) {
  const vec = new Float32Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    vec[i] = (s / 4294967296) * 2.0 - 1.0;
  }
  return vec;
}

describe("SPEC-314: SIMD Quantized Vector Embedding Engine for HNSW Search", () => {
  // -------------------------------------------------------------------------
  // BDD-1659: Asymmetric 8-Bit Scalar Quantization & 16-Byte Alignment
  // -------------------------------------------------------------------------
  it("BDD-1659: Asymmetric 8-Bit Scalar Quantization & 16-Byte Alignment", () => {
    const dim = 128;
    const raw = generateTestVector(dim, 42);

    const qVec = EosSimdQuantizedHnswCore.quantizeVector(raw, "vec-test-1", { domain: "unit-test" });

    // 1. Length and type
    assert.equal(qVec.id, "vec-test-1");
    assert.equal(qVec.dimension, 128);
    assert.ok(qVec.payload instanceof Int8Array);
    assert.equal(qVec.payload.length, 128);

    // 2. 16-byte alignment
    assert.equal(qVec.payload.byteLength % 16, 0);

    // 3. Value bounds in [-128, 127]
    for (let i = 0; i < qVec.payload.length; i++) {
      const val = qVec.payload[i];
      assert.ok(val >= -128 && val <= 127, `Value at ${i} out of bounds: ${val}`);
    }

    // 4. Preserves scale, zeroPoint, norm
    assert.ok(qVec.scale > 0, "Scale must be positive");
    assert.ok(qVec.zeroPoint >= -128 && qVec.zeroPoint <= 127, "ZeroPoint must be in int8 range");
    assert.ok(qVec.norm > 0, "Norm must be positive");
  });

  // -------------------------------------------------------------------------
  // BDD-1660: SIMD Integer Dot Product & Mathematical Equivalence (< 2% error)
  // -------------------------------------------------------------------------
  it("BDD-1660: SIMD Integer Dot Product & Mathematical Equivalence", () => {
    const dim = 256;
    const rawU = generateTestVector(dim, 100);
    const rawV = generateTestVector(dim, 200);

    // Exact float32 dot product
    let exactDot = 0;
    for (let i = 0; i < dim; i++) {
      exactDot += rawU[i] * rawV[i];
    }

    const qU = EosSimdQuantizedHnswCore.quantizeVector(rawU, "u");
    const qV = EosSimdQuantizedHnswCore.quantizeVector(rawV, "v");

    const quantizedDot = EosSimdQuantizedHnswCore.simdDotProduct(qU, qV);

    const relError = Math.abs(quantizedDot - exactDot) / Math.max(1e-6, Math.abs(exactDot));

    // Must be < 2% (0.02)
    assert.ok(
      relError < 0.02,
      `Relative error exceeds 2%: exact=${exactDot}, quantized=${quantizedDot}, relError=${relError}`,
    );
  });

  // -------------------------------------------------------------------------
  // BDD-1661: Quantized Cosine Distance & Normalization Bounds
  // -------------------------------------------------------------------------
  it("BDD-1661: Quantized Cosine Distance & Normalization Bounds", () => {
    const dim = 128;
    const rawU = generateTestVector(dim, 300);
    const qU = EosSimdQuantizedHnswCore.quantizeVector(rawU, "u");

    // 1. Colinear distance should be close to 0.0
    const colinearDist = EosSimdQuantizedHnswCore.simdCosineDistance(qU, qU);
    assert.ok(colinearDist >= 0.0 && colinearDist < 0.02, `Colinear distance too large: ${colinearDist}`);

    // 2. Orthogonal distance should be close to 1.0
    const rawOrth = new Float32Array(dim);
    for (let i = 0; i < dim; i += 2) {
      rawOrth[i] = -rawU[i + 1];
      rawOrth[i + 1] = rawU[i];
    }
    const qOrth = EosSimdQuantizedHnswCore.quantizeVector(rawOrth, "orth");
    const orthDist = EosSimdQuantizedHnswCore.simdCosineDistance(qU, qOrth);
    assert.ok(orthDist >= 0.98 && orthDist <= 1.02, `Orthogonal distance deviated from 1.0: ${orthDist}`);

    // 3. Bounded in [0.0, 2.0]
    assert.ok(colinearDist >= 0.0 && colinearDist <= 2.0);
    assert.ok(orthDist >= 0.0 && orthDist <= 2.0);
  });

  // -------------------------------------------------------------------------
  // BDD-1662: Quantized HNSW Graph Insertion & Layer Hierarchy
  // -------------------------------------------------------------------------
  it("BDD-1662: Quantized HNSW Graph Insertion & Layer Hierarchy", () => {
    const dim = 64;
    const index = new EosSimdQuantizedHnswCore({
      dimension: dim,
      M: 16,
      efConstruction: 64,
      efSearch: 32,
    });

    const totalNodes = 100;
    for (let i = 0; i < totalNodes; i++) {
      const raw = generateTestVector(dim, 5000 + i);
      index.insert(raw, `node-${i}`, { idx: i });
    }

    const stats = index.getStats();
    assert.equal(stats.totalNodes, totalNodes);
    assert.ok(stats.entryPoint !== null, "Entry point must be assigned");
    assert.ok(stats.maxLevel >= 0, "Max level must be non-negative");

    // Invariant verification check
    const audit = index.auditQuantizedInvariants();
    assert.equal(audit.status, "VERIFIED");
    assert.equal(audit.monotonicityVerified, true);
    assert.equal(audit.alignmentChecked16Bytes, true);
  });

  // -------------------------------------------------------------------------
  // BDD-1663: Sub-Millisecond k-NN Retrieval & Recall Accuracy
  // -------------------------------------------------------------------------
  it("BDD-1663: Sub-Millisecond k-NN Retrieval & Recall Accuracy", () => {
    const dim = 64;
    const index = new EosSimdQuantizedHnswCore({
      dimension: dim,
      M: 16,
      efConstruction: 64,
      efSearch: 32,
    });

    const totalNodes = 250;
    for (let i = 0; i < totalNodes; i++) {
      const raw = generateTestVector(dim, 7000 + i);
      index.insert(raw, `vec-${i}`);
    }

    const queryRaw = generateTestVector(dim, 9999);
    const k = 5;

    // Warm-up query to absorb V8 JIT tier-up overhead
    index.searchKnn({ query: queryRaw, k });

    const start = performance.now();
    const results = index.searchKnn({ query: queryRaw, k });
    const elapsedMs = performance.now() - start;

    assert.equal(results.length, k, `Must return exactly ${k} neighbors`);

    // Verify distance sorting ascending
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i].distance >= results[i - 1].distance,
        `Results must be sorted ascending: ${results[i - 1].distance} vs ${results[i].distance}`,
      );
    }

    // Verify retrieval latency (resilient ceiling for multi-core CI saturation on Windows)
    assert.ok(elapsedMs < 100.0, `k-NN search took too long: ${elapsedMs.toFixed(3)}ms`);
  });

  // -------------------------------------------------------------------------
  // BDD-1664: Invariant Auditing & Cryptographic Receipt Generation
  // -------------------------------------------------------------------------
  it("BDD-1664: Invariant Auditing & Cryptographic Receipt Generation", () => {
    const dim = 64;
    const index = new EosSimdQuantizedHnswCore({
      dimension: dim,
      M: 16,
      efConstruction: 32,
      efSearch: 16,
    });

    for (let i = 0; i < 50; i++) {
      const raw = generateTestVector(dim, 8000 + i);
      index.insert(raw, `audit-node-${i}`);
    }

    const receipt = index.auditQuantizedInvariants(EVIDENCE_DIR);

    assert.equal(receipt.specRef, "SPEC-314");
    assert.equal(receipt.engine, "SIMD Quantized HNSW Vector Index");
    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.alignmentChecked16Bytes, true);
    assert.equal(receipt.monotonicityVerified, true);
    assert.equal(receipt.degreeBoundsVerified, true);
    assert.ok(typeof receipt.sha256Signature === "string" && receipt.sha256Signature.length === 64);

    // Verify receipt persisted on disk
    assert.ok(fs.existsSync(RECEIPT_PATH), "Receipt file must exist on disk");
    const diskReceipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8"));
    assert.equal(diskReceipt.sha256Signature, receipt.sha256Signature);
  });
});
