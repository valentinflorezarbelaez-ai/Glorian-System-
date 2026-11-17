/**
 * @file test/eosRingAllReduce.test.mjs
 * @description BDD test suite for SPEC-320 / CHANGE-182: Ring All-Reduce Distributed
 * Tensor Parallelism & Cross-Worker Collective Communication Engine.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosRingAllReduceCore } from "../src/core/eosRingAllReduce.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/RING_ALLREDUCE_RECEIPT.json");

describe("SPEC-320: Ring All-Reduce Distributed Tensor Parallelism Engine", () => {
  test("BDD-1695: Ring Topology Formation & Neighbor Adjacency", () => {
    const p = 4;
    const engine = new EosRingAllReduceCore({ workerCount: p });
    const topology = engine.getTopology();

    assert.equal(topology.length, p);
    for (let w = 0; w < p; w++) {
      assert.equal(topology[w].workerId, w);
      assert.equal(topology[w].successorId, (w + 1) % p);
      assert.equal(topology[w].predecessorId, (w - 1 + p) % p);
    }

    // Explicit check on worker 3
    assert.equal(topology[3].successorId, 0);
    assert.equal(topology[3].predecessorId, 2);
  });

  test("BDD-1696: Tensor Chunking & Zero-Padding Alignment", () => {
    const p = 4;
    const m = 10;
    const engine = new EosRingAllReduceCore({ workerCount: p });

    const tensor = Array.from({ length: m }, (_, i) => (i + 1) * 1.5);
    const { chunks, chunkSize, paddingCount } = engine.partitionIntoChunks(tensor);

    // C = ceil(10 / 4) = 3
    assert.equal(chunkSize, 3);
    assert.equal(paddingCount, 2);
    assert.equal(chunks.length, 4);

    // Last chunk holds 1 value and 2 zeros
    assert.equal(chunks[3][0], tensor[9]);
    assert.equal(chunks[3][1], 0.0);
    assert.equal(chunks[3][2], 0.0);

    // Reconstruct and verify exact equality with original
    const reconstructed = engine.reconstructTensor(chunks, m);
    assert.equal(reconstructed.length, m);
    assert.deepEqual(reconstructed, tensor);
  });

  test("BDD-1697: Scatter-Reduce Accumulation & Reduced Chunk Ownership", () => {
    const p = 4;
    const engine = new EosRingAllReduceCore({ workerCount: p });

    // Distinct worker tensors
    const tensors = [
      [1, 2, 3, 4, 5, 6, 7, 8],
      [10, 20, 30, 40, 50, 60, 70, 80],
      [100, 200, 300, 400, 500, 600, 700, 800],
      [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
    ];

    const partitioned = tensors.map((t) => engine.partitionIntoChunks(t));
    const workerChunks = partitioned.map((pt) => pt.chunks.map((c) => [...c]));
    const chunkSize = partitioned[0].chunkSize;

    const scatterRes = engine.executeScatterReduce(workerChunks, chunkSize);

    // Exactly P - 1 = 3 steps
    assert.equal(scatterRes.steps.length, 3);

    // Verify chunk ownership: worker w owns chunk (w + 1) % p
    assert.equal(scatterRes.chunkOwnership[0], 1);
    assert.equal(scatterRes.chunkOwnership[1], 2);
    assert.equal(scatterRes.chunkOwnership[2], 3);
    assert.equal(scatterRes.chunkOwnership[3], 0);

    // Compute expected global sums per chunk
    const fullSum = [1111, 2222, 3333, 4444, 5555, 6666, 7777, 8888];
    const expectedChunks = [fullSum.slice(0, 2), fullSum.slice(2, 4), fullSum.slice(4, 6), fullSum.slice(6, 8)];

    // Worker 0 holds chunk 1
    assert.deepEqual(workerChunks[0][1], expectedChunks[1]);
    // Worker 1 holds chunk 2
    assert.deepEqual(workerChunks[1][2], expectedChunks[2]);
    // Worker 2 holds chunk 3
    assert.deepEqual(workerChunks[2][3], expectedChunks[3]);
    // Worker 3 holds chunk 0
    assert.deepEqual(workerChunks[3][0], expectedChunks[0]);
  });

  test("BDD-1698: All-Gather Distribution & Global Synchronization", () => {
    const p = 4;
    const m = 10;
    const engine = new EosRingAllReduceCore({ workerCount: p });

    const tensors = Array.from({ length: p }, (_, w) => Array.from({ length: m }, (_, i) => (w + 1) * 10 + (i + 1)));

    const partitioned = tensors.map((t) => engine.partitionIntoChunks(t));
    const workerChunks = partitioned.map((pt) => pt.chunks.map((c) => [...c]));
    const chunkSize = partitioned[0].chunkSize;

    engine.executeScatterReduce(workerChunks, chunkSize);
    const gatherRes = engine.executeAllGather(workerChunks);

    assert.equal(gatherRes.steps.length, 3);

    // Reconstruct all worker tensors
    const synced = workerChunks.map((c) => engine.reconstructTensor(c, m));

    // Every worker must hold strictly identical tensors
    for (let w = 1; w < p; w++) {
      assert.deepEqual(synced[w], synced[0]);
    }

    // Verify mathematical ground truth against central sum
    const centralSum = Array.from({ length: m }, (_, i) => tensors.reduce((acc, t) => acc + t[i], 0));
    assert.deepEqual(synced[0], centralSum);
  });

  test("BDD-1699: Optimal Bandwidth Bound Verification", () => {
    const p = 8;
    const m = 1000;
    const engine = new EosRingAllReduceCore({ workerCount: p });

    const tensors = Array.from({ length: p }, (_, w) => Array.from({ length: m }, (_, i) => (w + 1) * 0.1 + i));

    const result = engine.allReduce(tensors);

    // Chunk size C = ceil(1000 / 8) = 125
    assert.equal(result.chunkSize, 125);
    // Bytes transferred per worker: 2 * (P - 1) * C * 4 bytes
    // 2 * 7 * 125 * 4 = 7000 bytes
    assert.equal(result.bytesTransferredPerWorker, 7000);
    assert.equal(result.totalCommunicationSteps, 2 * (p - 1));
    assert.equal(result.isMathematicallyEquivalent, true);
    assert.ok(result.maxAbsoluteErrorAgainstCentral <= 1e-6);

    // Naive central gather-broadcast transfers 2 * (P - 1) * M * 4 bytes = 56000 bytes
    const centralBytes = 2 * (p - 1) * m * 4;
    assert.equal(centralBytes, 56000);
    assert.equal(centralBytes / result.bytesTransferredPerWorker, 8); // 8x reduction
  });

  test("BDD-1700: Structural Invariant Audit & Cryptographic SHA-256 Receipt", () => {
    const engine = new EosRingAllReduceCore({ workerCount: 4 });
    const receipt = engine.audit(4, 32);

    assert.equal(receipt.auditStatus, "VERIFIED");
    assert.equal(receipt.workerCount, 4);
    assert.equal(receipt.tensorLength, 32);
    assert.equal(receipt.ringSymmetryCertified, true);
    assert.equal(receipt.bandwidthBoundCertified, true);
    assert.ok(receipt.maxAbsoluteError <= 1e-6);
    assert.equal(typeof receipt.sha256Receipt, "string");
    assert.equal(receipt.sha256Receipt.length, 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
