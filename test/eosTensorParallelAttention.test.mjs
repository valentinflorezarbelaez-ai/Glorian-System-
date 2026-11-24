/**
 * @file test/eosTensorParallelAttention.test.mjs
 * @description BDD test suite for SPEC-323 / CHANGE-185: Tensor Parallel
 * Multi-Head & Grouped-Query Attention (TP-MHA / TP-GQA) with Sequence
 * Parallelism and Ring Attention.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosTensorParallelAttentionCore } from "../src/core/eosTensorParallelAttention.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("TENSOR_PARALLEL_ATTENTION_RECEIPT.json", ROOT);

describe("SPEC-323: Tensor Parallel Attention Engine (TP-MHA / TP-GQA)", () => {
  test("BDD-1713: Multi-Head & Grouped-Query Attention Head Partitioning", () => {
    // GQA configuration: 8 Q heads, 2 KV heads (4:1 ratio) across 2 workers
    const engine = new EosTensorParallelAttentionCore({
      workerCount: 2,
      totalQHeads: 8,
      totalKVHeads: 2,
      headDim: 4,
    });

    assert.equal(engine.gqaRatio, 4);

    const partitions = engine.partitionAttentionHeads();
    assert.equal(partitions.length, 2);

    // Worker 0: Q heads [0, 1, 2, 3], KV heads [0]
    assert.deepEqual(partitions[0].qHeadIndices, [0, 1, 2, 3]);
    assert.deepEqual(partitions[0].kvHeadIndices, [0]);
    assert.equal(partitions[0].numQHeads, 4);
    assert.equal(partitions[0].numKVHeads, 1);

    // Worker 1: Q heads [4, 5, 6, 7], KV heads [1]
    assert.deepEqual(partitions[1].qHeadIndices, [4, 5, 6, 7]);
    assert.deepEqual(partitions[1].kvHeadIndices, [1]);
    assert.equal(partitions[1].numQHeads, 4);
    assert.equal(partitions[1].numKVHeads, 1);

    // Sum of local heads strictly preserves totals
    const sumQ = partitions.reduce((acc, p) => acc + p.numQHeads, 0);
    const sumKV = partitions.reduce((acc, p) => acc + p.numKVHeads, 0);
    assert.equal(sumQ, 8);
    assert.equal(sumKV, 2);

    // Rejects invalid divisibility configurations
    assert.throws(
      () =>
        new EosTensorParallelAttentionCore({
          workerCount: 3,
          totalQHeads: 8,
          totalKVHeads: 2,
        }),
      RangeError,
    );
  });

  test("BDD-1714: Column-Parallel Q, K, V Projections Without Communication", () => {
    const P = 2;
    const engine = new EosTensorParallelAttentionCore({
      workerCount: P,
      totalQHeads: 4,
      totalKVHeads: 2,
      headDim: 4,
    });

    const d = 16;
    const W_q = Array.from({ length: d }, (_, r) => Array.from({ length: 16 }, (_, c) => (r + 1) * 0.1 + c * 0.05));
    const W_k = Array.from({ length: d }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 1) * 0.12 + c * 0.04));
    const W_v = Array.from({ length: d }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 1) * 0.14 + c * 0.03));
    const W_o = Array.from({ length: 16 }, (_, r) => Array.from({ length: d }, (_, c) => (r + 1) * 0.08 + c * 0.02));

    const shards = engine.partitionWeights(W_q, W_k, W_v, W_o);
    assert.equal(shards.length, P);

    // Worker 0: W_q shape [d, 8], W_k shape [d, 4], W_v shape [d, 4], W_o shape [8, d]
    assert.equal(shards[0].wqShard.length, d);
    assert.equal(shards[0].wqShard[0].length, 8);
    assert.equal(shards[0].wkShard.length, d);
    assert.equal(shards[0].wkShard[0].length, 4);
    assert.equal(shards[0].wvShard.length, d);
    assert.equal(shards[0].wvShard[0].length, 4);
    assert.equal(shards[0].woShard.length, 8);
    assert.equal(shards[0].woShard[0].length, d);

    // Verify mathematical match with column slices
    const X = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]];
    const Q_local0 = engine.matmul(X, shards[0].wqShard);
    const Q_central = engine.matmul(X, W_q);
    assert.deepEqual(Q_local0[0], Q_central[0].slice(0, 8));
  });

  test("BDD-1715: Local Head Attention Computation & Online Softmax", () => {
    const engine = new EosTensorParallelAttentionCore({
      workerCount: 2,
      totalQHeads: 4,
      totalKVHeads: 2,
      headDim: 4,
    });

    const B = 1;
    const S = 3;
    // Worker 0 holds 2 Q heads and 1 KV head -> local dims: Q [1, 3, 8], K [1, 3, 4], V [1, 3, 4]
    const Q_local = [
      [
        [1, 0, 1, 0, 0, 1, 0, 1],
        [0, 1, 0, 1, 1, 0, 1, 0],
        [1, 1, 0, 0, 0, 0, 1, 1],
      ],
    ];
    const K_local = [
      [
        [1, 0, 0, 1],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
      ],
    ];
    const V_local = [
      [
        [2, 3, 4, 5],
        [1, 2, 3, 4],
        [0, 1, 2, 3],
      ],
    ];

    const A_local = engine.forwardLocalAttention(Q_local, K_local, V_local);

    assert.equal(A_local.length, B);
    assert.equal(A_local[0].length, S);
    assert.equal(A_local[0][0].length, 8); // 2 Q heads * 4 headDim
  });

  test("BDD-1716: Row-Parallel Output Projection & Single All-Reduce Barrier", () => {
    const engine = new EosTensorParallelAttentionCore({
      workerCount: 2,
      totalQHeads: 4,
      totalKVHeads: 2,
      headDim: 4,
    });

    const B = 2;
    const S = 4;
    const d = 16;
    const X = Array.from({ length: B }, (_, b) =>
      Array.from({ length: S }, (_, s) =>
        Array.from({ length: d }, (_, dim) => (b + 1) * 0.1 + (s + 1) * 0.05 + dim * 0.01),
      ),
    );

    const W_q = Array.from({ length: d }, (_, r) => Array.from({ length: 16 }, (_, c) => (r + 1) * 0.02 + c * 0.01));
    const W_k = Array.from({ length: d }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 1) * 0.015 + c * 0.01));
    const W_v = Array.from({ length: d }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 1) * 0.025 + c * 0.01));
    const W_o = Array.from({ length: 16 }, (_, r) => Array.from({ length: d }, (_, c) => (r + 1) * 0.03 + c * 0.01));

    const result = engine.forwardTensorParallelAttention(X, W_q, W_k, W_v, W_o);

    assert.equal(result.allReduceCount, 1);
    assert.equal(result.workerCount, 2);
    assert.equal(result.isMathEquivalent, true);
    assert.ok(result.maxAbsoluteError <= 1e-4);
  });

  test("BDD-1717: Ring Attention Circular Shift Over Distributed Sequence", () => {
    const engine = new EosTensorParallelAttentionCore({
      workerCount: 2,
      totalQHeads: 4,
      totalKVHeads: 2,
      headDim: 4,
    });

    const P = 2;
    const B = 1;
    const S_local = 3;
    const d = 4;

    const Q_shards = Array.from({ length: P }, (_, p) =>
      Array.from({ length: B }, () =>
        Array.from({ length: S_local }, () => Array.from({ length: d }, (_, dim) => (p + 1) * 0.2 + dim * 0.05)),
      ),
    );
    const K_shards = Array.from({ length: P }, (_, p) =>
      Array.from({ length: B }, () =>
        Array.from({ length: S_local }, () => Array.from({ length: d }, (_, dim) => (p + 1) * 0.15 + dim * 0.05)),
      ),
    );
    const V_shards = Array.from({ length: P }, (_, p) =>
      Array.from({ length: B }, () =>
        Array.from({ length: S_local }, () => Array.from({ length: d }, (_, dim) => (p + 1) * 0.25 + dim * 0.05)),
      ),
    );

    const ringResult = engine.forwardRingAttention(Q_shards, K_shards, V_shards);

    assert.equal(ringResult.numRingSteps, P);
    assert.equal(ringResult.localSequenceLength, S_local);
    assert.equal(ringResult.totalSequenceLength, S_local * P);
    assert.equal(ringResult.isExactMatch, true);
    assert.ok(ringResult.maxAbsoluteError <= 1e-4);
  });

  test("BDD-1718: Invariant Auditing & Cryptographic SHA-256 Receipt", () => {
    const engine = new EosTensorParallelAttentionCore({
      workerCount: 2,
      totalQHeads: 4,
      totalKVHeads: 2,
    });

    const receipt = engine.audit();

    assert.equal(receipt.auditStatus, "VERIFIED");
    assert.equal(receipt.headConservationCertified, true);
    assert.equal(receipt.singleBarrierCertified, true);
    assert.equal(receipt.mathParityCertified, true);
    assert.equal(receipt.ringAttentionCertified, true);
    assert.ok(receipt.sha256Receipt.length === 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

    const diskReceipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8"));
    assert.equal(diskReceipt.auditStatus, "VERIFIED");
    assert.equal(diskReceipt.sha256Receipt, receipt.sha256Receipt);
  });
});
