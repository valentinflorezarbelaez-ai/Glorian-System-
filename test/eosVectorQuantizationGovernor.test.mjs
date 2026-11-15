/**
 * EOS System — Sharded Vector Indexing & SIMD-Style Quantization Governor Test Suite
 * SPEC-283 (CHANGE-145) — BDD-1473..1478
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosVectorQuantizationGovernor } from "../src/core/eosVectorQuantizationGovernor.ts";

const SAMPLE_PATH = path.resolve("templates/vectors/sample-embeddings.json");
const RECEIPT_PATH = path.resolve("docs/evidence/VECTOR_INDEX_RECEIPT.json");

describe("SPEC-283: Sharded Vector Indexing & SIMD-Style Quantization Governor", () => {
  const sampleVectors = JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8"));

  it("BDD-1473: Scalar Quantization SQ8 and Dequantization Accuracy", () => {
    const rawVector = [0.12, 0.45, -0.67, 0.89, -0.23, 0.56, 0.78, -0.34];
    const { quantized, scale, offset } = EosVectorQuantizationGovernor.quantizeSQ8(rawVector);

    assert.equal(quantized.length, rawVector.length);
    assert.ok(scale > 0);
    assert.equal(offset, -0.67);

    for (const q of quantized) {
      assert.ok(q >= 0 && q <= 255);
    }

    const dequantized = EosVectorQuantizationGovernor.dequantizeSQ8(quantized, scale, offset);
    let mse = 0;
    for (let i = 0; i < rawVector.length; i++) {
      const diff = rawVector[i] - dequantized[i];
      mse += diff * diff;
    }
    mse /= rawVector.length;

    assert.ok(mse < 0.005, `Expected MSE < 0.005, got ${mse}`);
  });

  it("BDD-1474: High-Throughput Unrolled Cosine Similarity Calculation", () => {
    const vecA = [1, 0, 0, 0, 0, 0, 0, 0];
    const vecB = [1, 0, 0, 0, 0, 0, 0, 0];
    const vecC = [0, 1, 0, 0, 0, 0, 0, 0];
    const vecD = [-1, 0, 0, 0, 0, 0, 0, 0];

    const simIdentical = EosVectorQuantizationGovernor.cosineSimilarity(vecA, vecB);
    const simOrthogonal = EosVectorQuantizationGovernor.cosineSimilarity(vecA, vecC);
    const simOpposite = EosVectorQuantizationGovernor.cosineSimilarity(vecA, vecD);

    assert.equal(Math.round(simIdentical * 10000) / 10000, 1.0);
    assert.equal(Math.round(simOrthogonal * 10000) / 10000, 0.0);
    assert.equal(Math.round(simOpposite * 10000) / 10000, -1.0);
  });

  it("BDD-1475: Sharded Vector Index Construction", () => {
    const index = EosVectorQuantizationGovernor.buildIndex(sampleVectors, "test-idx-01");

    assert.equal(index.totalVectors, 5);
    assert.equal(index.dimension, 8);
    assert.ok(index.shards["us-east"]);
    assert.ok(index.shards["eu-central"]);
    assert.ok(index.shards["ap-southeast"]);
    assert.equal(index.shards["us-east"].length, 2);
    assert.equal(index.shards["eu-central"].length, 2);
    assert.equal(index.shards["ap-southeast"].length, 1);
  });

  it("BDD-1476: Top-K Nearest Neighbor Retrieval", () => {
    const index = EosVectorQuantizationGovernor.buildIndex(sampleVectors);
    const query = sampleVectors[0].values; // doc-001
    const results = EosVectorQuantizationGovernor.searchKnn(index, query, 3);

    assert.equal(results.length, 3);
    assert.equal(results[0].id, "doc-001");
    assert.ok(results[0].score >= 0.99);
    assert.equal(results[1].id, "doc-002"); // Close neighbor
    assert.ok(results[0].score >= results[1].score);
    assert.ok(results[1].score >= results[2].score);
  });

  it("BDD-1477: Shard Filtered Search Routing", () => {
    const index = EosVectorQuantizationGovernor.buildIndex(sampleVectors);
    const query = sampleVectors[0].values;
    const results = EosVectorQuantizationGovernor.searchKnn(index, query, 5, "eu-central");

    assert.equal(results.length, 2);
    for (const res of results) {
      assert.equal(res.partition, "eu-central");
    }
  });

  it("BDD-1478: Cryptographic Index Evidence Receipt", () => {
    const index = EosVectorQuantizationGovernor.buildIndex(sampleVectors);
    const receipt = EosVectorQuantizationGovernor.generateReceipt(index, RECEIPT_PATH);

    assert.ok(fs.existsSync(RECEIPT_PATH));
    assert.equal(receipt.totalVectors, 5);
    assert.equal(receipt.dimension, 8);
    assert.equal(receipt.shardsCount, 3);
    assert.equal(typeof receipt.sha256Signature, "string");
    assert.equal(receipt.sha256Signature.length, 64);
  });
});
