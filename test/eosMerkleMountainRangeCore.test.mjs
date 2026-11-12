/**
 * EOS Layer-0 Merkle Mountain Range (MMR) Core Test Suite
 * Governed by SPEC-216: FR-1099..FR-1103 and BDD-1099..BDD-1103.
 * Zero external runtime dependencies.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosMerkleMountainRangeCore,
  calculateNodeHeight,
  calculatePeaks,
  calculateBagOfPeaks,
} from "../src/core/eosMerkleMountainRangeCore.ts";

describe("EosMerkleMountainRangeCore (SPEC-216 / BDD-1099..BDD-1103)", () => {
  test("BDD-1099: Bitwise MMR Positional Math and Peak Identification", () => {
    assert.strictEqual(typeof EosMerkleMountainRangeCore, "function");
    assert.strictEqual(typeof calculateNodeHeight, "function");
    assert.strictEqual(typeof calculatePeaks, "function");

    // Leaf nodes have height 0
    assert.strictEqual(calculateNodeHeight(0), 0);
    assert.strictEqual(calculateNodeHeight(1), 0);
    // Parent of 0 and 1 is at pos 2, height 1
    assert.strictEqual(calculateNodeHeight(2), 1);
    assert.strictEqual(calculateNodeHeight(3), 0);
    assert.strictEqual(calculateNodeHeight(4), 0);
    assert.strictEqual(calculateNodeHeight(5), 1);
    // Peak combining pos 2 and 5 is at pos 6, height 2
    assert.strictEqual(calculateNodeHeight(6), 2);

    // 7 leaves produce 11 nodes with 3 peaks: heights 2, 1, 0 (7 = 4 + 2 + 1)
    const peaks = calculatePeaks(11);
    assert.strictEqual(peaks.length, 3);
    assert.deepStrictEqual(peaks[0], { pos: 6, height: 2 });
    assert.deepStrictEqual(peaks[1], { pos: 9, height: 1 });
    assert.deepStrictEqual(peaks[2], { pos: 10, height: 0 });
  });

  test("BDD-1100: Append-Only Invariant and Non-Destructive Mutations", () => {
    const mmr = new EosMerkleMountainRangeCore();
    assert.strictEqual(mmr.getLeafCount(), 0);
    assert.strictEqual(mmr.getSize(), 0);

    // Append 5 leaves
    for (let i = 0; i < 5; i++) {
      mmr.append(`record-${i}`);
    }

    assert.strictEqual(mmr.getLeafCount(), 5);
    const sizeBefore = mmr.getSize();
    const nodeHashesBefore = [];
    for (let i = 0; i < sizeBefore; i++) {
      nodeHashesBefore.push(mmr.getNode(i)?.hash);
    }

    // Append 3 more leaves
    for (let i = 5; i < 8; i++) {
      mmr.append(`record-${i}`);
    }

    assert.strictEqual(mmr.getLeafCount(), 8);
    // Prior node hashes in [0, sizeBefore - 1] MUST be strictly unmodified
    for (let i = 0; i < sizeBefore; i++) {
      assert.strictEqual(mmr.getNode(i)?.hash, nodeHashesBefore[i]);
    }
  });

  test("BDD-1101: Bag-of-Peaks Collision-Resistant Root Calculation", () => {
    const mmr1 = new EosMerkleMountainRangeCore();
    const mmr2 = new EosMerkleMountainRangeCore();
    const mmr3 = new EosMerkleMountainRangeCore();

    const data = ["payload-alpha", "payload-beta", "payload-gamma", "payload-delta"];
    mmr1.appendBatch(data);
    mmr2.appendBatch(data);

    // Identical leaf sequences must yield byte-for-byte identical roots
    assert.strictEqual(mmr1.getRoot(), mmr2.getRoot());

    // Divergent leaf must trigger full avalanche effect
    const divergentData = ["payload-alpha", "payload-beta", "payload-MUTATED", "payload-delta"];
    mmr3.appendBatch(divergentData);
    assert.notStrictEqual(mmr1.getRoot(), mmr3.getRoot());

    // Bag-of-peaks calculation matches getRoot()
    const peaks = mmr1.getPeaks();
    const computedBag = calculateBagOfPeaks(mmr1.getSize(), peaks);
    assert.strictEqual(computedBag, mmr1.getRoot());
  });

  test("BDD-1102: Succinct Inclusion Proof Generation and Fast Verification", () => {
    const mmr = new EosMerkleMountainRangeCore();
    const numLeaves = 100;
    for (let i = 0; i < numLeaves; i++) {
      mmr.append(`tx-batch-item-${i}`);
    }

    assert.strictEqual(mmr.getLeafCount(), numLeaves);

    // Generate inclusion proof for leaf index 42
    const targetLeafIndex = 42;
    const proof = mmr.getInclusionProof(targetLeafIndex);

    assert.strictEqual(proof.leafIndex, targetLeafIndex);
    assert.ok(proof.leafHash);
    // Sibling path length for 100 elements is O(log n) <= 10
    assert.ok(proof.siblings.length <= 10, `Sibling length ${proof.siblings.length} should be <= 10`);

    // Verification against authentic root
    const verifyRes = mmr.verifyInclusion(proof);
    assert.strictEqual(verifyRes.valid, true);
    assert.ok(verifyRes.verificationTimeMs < 10, `Verification time ${verifyRes.verificationTimeMs} ms`);
    assert.strictEqual(verifyRes.receipt.operation, "verify");
    assert.strictEqual(verifyRes.receipt.receiptSha256.length, 64);

    // Tampered leaf hash must fail verification
    const tamperedProof = {
      ...proof,
      leafHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    };
    const tamperedRes = mmr.verifyInclusion(tamperedProof);
    assert.strictEqual(tamperedRes.valid, false);

    // Tampered root must fail verification
    const tamperedRootProof = {
      ...proof,
      root: "deadbeef00000000deadbeef00000000deadbeef00000000deadbeef00000000",
    };
    const tamperedRootRes = mmr.verifyInclusion(tamperedRootProof);
    assert.strictEqual(tamperedRootRes.valid, false);
  });

  test("BDD-1103: Prefix Consistency Verification and CLI Dispatch", () => {
    const mmr = new EosMerkleMountainRangeCore();
    for (let i = 0; i < 50; i++) {
      mmr.append(`log-entry-${i}`);
    }
    const snap50 = mmr.exportSnapshot();

    for (let i = 50; i < 100; i++) {
      mmr.append(`log-entry-${i}`);
    }
    const snap100 = mmr.exportSnapshot();

    // Generate consistency proof from size 50 to size 100
    const consistencyProof = mmr.getConsistencyProof(snap50.mmrSize);
    assert.strictEqual(consistencyProof.fromSize, snap50.mmrSize);
    assert.strictEqual(consistencyProof.toSize, snap100.mmrSize);
    assert.strictEqual(consistencyProof.fromRoot, snap50.root);
    assert.strictEqual(consistencyProof.toRoot, snap100.root);

    const verifyConsistencyRes = mmr.verifyConsistency(consistencyProof);
    assert.strictEqual(verifyConsistencyRes.valid, true);
    assert.strictEqual(verifyConsistencyRes.receipt.operation, "verify");
    assert.strictEqual(verifyConsistencyRes.receipt.receiptSha256.length, 64);

    // CLI Dispatch Tests
    const cliPath = path.resolve(process.cwd(), "bin/eos.mjs");

    const appendOutput = execFileSync("node", [cliPath, "mmr:append", "--count=7", "--json"], {
      encoding: "utf8",
    });
    const appendJson = JSON.parse(appendOutput);
    assert.strictEqual(appendJson.leafIndex, 7);
    assert.ok(appendJson.root);
    assert.ok(Array.isArray(appendJson.peaks));

    const proveOutput = execFileSync("node", [cliPath, "mmr:prove", "--leaf=2", "--json"], {
      encoding: "utf8",
    });
    const proveJson = JSON.parse(proveOutput);
    assert.strictEqual(proveJson.leafIndex, 2);
    assert.strictEqual(proveJson.valid, true);
    assert.ok(proveJson.receipt.receiptSha256);

    const verifyOutput = execFileSync("node", [cliPath, "mmr:verify", "--leaf=2", "--json"], {
      encoding: "utf8",
    });
    const verifyJson = JSON.parse(verifyOutput);
    assert.strictEqual(verifyJson.valid, true);
    assert.ok(verifyJson.receipt.receiptSha256);
  });
});
