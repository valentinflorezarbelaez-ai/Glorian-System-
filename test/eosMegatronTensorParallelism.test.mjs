/**
 * @file test/eosMegatronTensorParallelism.test.mjs
 * @description BDD test suite for SPEC-321 / CHANGE-183: Megatron-LM Style
 * Tensor Parallelism (Column & Row Linear Sharding).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosMegatronTensorParallelismCore } from "../src/core/eosMegatronTensorParallelism.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("MEGATRON_TENSOR_PARALLELISM_RECEIPT.json", ROOT);

describe("SPEC-321: Megatron-LM Style Tensor Parallelism Engine", () => {
  test("BDD-1701: Column-Parallel Linear Projection & Dimension Partitioning", () => {
    const p = 2;
    const engine = new EosMegatronTensorParallelismCore({
      workerCount: p,
      inputDimension: 4,
      hiddenDimension: 8,
    });

    const X = [
      [1, 2, 3, 4],
      [0.5, 1.5, 2.5, 3.5],
    ];
    const W1 = Array.from({ length: 4 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 1) * 0.1 + (c + 1) * 0.05));
    const W2 = Array.from({ length: 8 }, () => [1, 2]);

    const shards = engine.partitionWeights(W1, W2);
    assert.equal(shards.length, 2);

    // Each worker holds [d_in, d_hidden / P] = [4, 4]
    assert.equal(shards[0].w1Shard.length, 4);
    assert.equal(shards[0].w1Shard[0].length, 4);
    assert.equal(shards[1].w1Shard.length, 4);
    assert.equal(shards[1].w1Shard[0].length, 4);

    // Execute local column projections
    const Y0 = engine.forwardColumnParallel(X, shards[0].w1Shard);
    const Y1 = engine.forwardColumnParallel(X, shards[1].w1Shard);

    assert.equal(Y0.length, 2);
    assert.equal(Y0[0].length, 4);
    assert.equal(Y1.length, 2);
    assert.equal(Y1[0].length, 4);

    // Verify mathematical match with full slice of monolithic matmul
    const Y_central = engine.matmul(X, W1);
    for (let r = 0; r < 2; r++) {
      assert.deepEqual(Y0[r], Y_central[r].slice(0, 4));
      assert.deepEqual(Y1[r], Y_central[r].slice(4, 8));
    }
  });

  test("BDD-1702: Local Fused Non-Linear Activation Without Inter-Worker Synchronization", () => {
    const engine = new EosMegatronTensorParallelismCore();

    const sample = [[-2.0, -1.0, 0.0, 1.0, 2.0]];

    // 1. GeLU
    const geluRes = engine.applyActivation(sample, "GELU");
    assert.equal(geluRes[0][2], 0.0); // GeLU(0) = 0
    assert.ok(Math.abs(geluRes[0][3] - 0.8413) < 0.01); // GeLU(1) ~ 0.8413
    assert.ok(Math.abs(geluRes[0][4] - 1.9545) < 0.01); // GeLU(2) ~ 1.9545

    // 2. SiLU
    const siluRes = engine.applyActivation(sample, "SILU");
    assert.equal(siluRes[0][2], 0.0); // SiLU(0) = 0
    assert.ok(Math.abs(siluRes[0][3] - 1 / (1 + Math.exp(-1))) < 1e-6);

    // In-place property: dimensions strictly preserved
    assert.equal(geluRes.length, sample.length);
    assert.equal(geluRes[0].length, sample[0].length);
  });

  test("BDD-1703: Row-Parallel Linear Projection & Local Matrix Multiplications", () => {
    const p = 2;
    const engine = new EosMegatronTensorParallelismCore({
      workerCount: p,
      hiddenDimension: 4,
      outputDimension: 2,
    });

    const W1 = Array.from({ length: 2 }, () => new Array(4).fill(0.1));
    const W2 = [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ];

    const shards = engine.partitionWeights(W1, W2);

    // Worker 0 holds rows 0..2, Worker 1 holds rows 2..4
    assert.equal(shards[0].w2Shard.length, 2);
    assert.equal(shards[1].w2Shard.length, 2);

    const Z0 = [[1, 2]];
    const Z1 = [[3, 4]];

    const O0 = engine.forwardRowParallel(Z0, shards[0].w2Shard);
    const O1 = engine.forwardRowParallel(Z1, shards[1].w2Shard);

    // O0 = [1, 2] * [[1, 2], [3, 4]] = [1*1 + 2*3, 1*2 + 2*4] = [7, 10]
    assert.deepEqual(O0[0], [7, 10]);

    // O1 = [3, 4] * [[5, 6], [7, 8]] = [3*5 + 4*7, 3*6 + 4*8] = [43, 50]
    assert.deepEqual(O1[0], [43, 50]);

    // Partial sum: O0 + O1 = [50, 60]
    const O_sum = engine.matAdd(O0, O1);
    assert.deepEqual(O_sum[0], [50, 60]);

    // Central match: [1, 2, 3, 4] * W2 = [1*1 + 2*3 + 3*5 + 4*7, 1*2 + 2*4 + 3*6 + 4*8] = [50, 60]
    const O_central = engine.matmul([[1, 2, 3, 4]], W2);
    assert.deepEqual(O_sum[0], O_central[0]);
  });

  test("BDD-1704: End-to-End Megatron MLP Block Execution & Single All-Reduce Barrier", () => {
    const p = 4;
    const engine = new EosMegatronTensorParallelismCore({
      workerCount: p,
      inputDimension: 4,
      hiddenDimension: 8,
      outputDimension: 4,
      activation: "GELU",
    });

    const X = [
      [1.0, 2.0, 3.0, 4.0],
      [-1.0, 0.5, 2.5, -0.5],
    ];

    const W1 = Array.from({ length: 4 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 1) * 0.2 - (c + 1) * 0.05));
    const W2 = Array.from({ length: 8 }, (_, r) => Array.from({ length: 4 }, (_, c) => (r + 1) * 0.1 + (c + 1) * 0.15));

    const mlpResult = engine.forwardMlp(X, W1, W2);

    // Exactly 1 All-Reduce barrier across the entire 2-layer MLP block
    assert.equal(mlpResult.totalAllReduceBarriers, 1);
    assert.equal(mlpResult.workerCount, p);
    assert.equal(mlpResult.batchSize, 2);
    assert.equal(mlpResult.outputDimension, 4);

    // Exact mathematical match with centralized reference
    assert.equal(mlpResult.isMathematicallyEquivalent, true);
    assert.ok(mlpResult.maxAbsoluteErrorAgainstCentral <= 1e-6);

    // Verify output shape [2, 4]
    assert.equal(mlpResult.synchronizedOutput.length, 2);
    assert.equal(mlpResult.synchronizedOutput[0].length, 4);
  });

  test("BDD-1705: Vocabulary Parallelism & Sharded Cross-Entropy Loss Computation", () => {
    const p = 4;
    const vocabSize = 16;
    const engine = new EosMegatronTensorParallelismCore({ workerCount: p });

    const hidden = [
      [1.0, 0.5, -0.5, 2.0],
      [0.2, -1.0, 1.5, 0.8],
    ];

    const vocabWeights = Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: vocabSize }, (_, v) => (r + 1) * 0.1 + (v + 1) * 0.03),
    );

    const targetTokens = [3, 14];

    const ceResult = engine.computeShardedCrossEntropy(hidden, vocabWeights, targetTokens);

    assert.equal(ceResult.workerCount, p);
    assert.equal(ceResult.vocabularySize, vocabSize);
    assert.equal(ceResult.vocabPerWorker, 4);
    assert.equal(ceResult.isLossEquivalent, true);
    assert.ok(ceResult.maxAbsoluteErrorAgainstCentral <= 1e-6);
    assert.ok(ceResult.loss > 0);
  });

  test("BDD-1706: Structural Invariant Audit & Cryptographic SHA-256 Receipt", () => {
    const engine = new EosMegatronTensorParallelismCore({ workerCount: 4 });
    const receipt = engine.audit(4, 2, 4, 8, 4, 16);

    assert.equal(receipt.auditStatus, "VERIFIED");
    assert.equal(receipt.workerCount, 4);
    assert.equal(receipt.singleBarrierCertified, true);
    assert.equal(receipt.numericalParityCertified, true);
    assert.equal(receipt.shardedCrossEntropyCertified, true);
    assert.equal(typeof receipt.sha256Receipt, "string");
    assert.equal(receipt.sha256Receipt.length, 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
