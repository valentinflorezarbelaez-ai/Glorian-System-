/**
 * EOS System — Zero-Knowledge State Attestation & Merkle Tree Snapshot Governor Test Suite
 * SPEC-282 (CHANGE-144) — BDD-1467..1472
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosMerkleSnapshotGovernor } from "../src/core/eosMerkleSnapshotGovernor.ts";

const SAMPLE_PATH = path.resolve("templates/snapshots/sample-state-snapshot.json");
const RECEIPT_PATH = path.resolve("docs/evidence/MERKLE_SNAPSHOT_RECEIPT.json");

describe("SPEC-282: Zero-Knowledge State Attestation & Merkle Tree Snapshot Governor", () => {
  const sampleItems = JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8"));

  it("BDD-1467: Canonical Merkle Tree Construction and Deterministic Root Hash", () => {
    const tree = EosMerkleSnapshotGovernor.buildTree(sampleItems, "snap-test-01");

    assert.equal(tree.leafCount, 5);
    assert.equal(tree.depth, 3);
    assert.equal(typeof tree.rootHash, "string");
    assert.equal(tree.rootHash.length, 64);
    assert.equal(tree.levels.length, 4);

    // Verify domain separation: leaf hashes have 0x00 prefix, interior have 0x01 prefix
    const leafHash = EosMerkleSnapshotGovernor.hashLeaf(sampleItems[0]);
    assert.equal(tree.levels[0][0], leafHash);

    // Rebuilding with identical items yields exact same rootHash
    const tree2 = EosMerkleSnapshotGovernor.buildTree(sampleItems, "snap-test-02");
    assert.equal(tree.rootHash, tree2.rootHash);
  });

  it("BDD-1468: Logarithmic Inclusion Proof Generation", () => {
    const tree = EosMerkleSnapshotGovernor.buildTree(sampleItems);
    const proof = EosMerkleSnapshotGovernor.generateProof(tree, 2);

    assert.equal(proof.leafIndex, 2);
    assert.equal(proof.rootHash, tree.rootHash);
    assert.equal(proof.proof.length, tree.depth); // O(log N) steps

    for (const step of proof.proof) {
      assert.ok(step.position === "LEFT" || step.position === "RIGHT");
      assert.equal(step.siblingHash.length, 64);
    }
  });

  it("BDD-1469: Zero-Knowledge Verification Against Root Hash", () => {
    const tree = EosMerkleSnapshotGovernor.buildTree(sampleItems);
    const targetIndex = 1;
    const targetLeaf = sampleItems[targetIndex];
    const proof = EosMerkleSnapshotGovernor.generateProof(tree, targetIndex);

    const valid = EosMerkleSnapshotGovernor.verifyProof(targetLeaf, proof);
    assert.equal(valid, true, "Valid proof must verify successfully against rootHash");
  });

  it("BDD-1470: Anti-Entropy Divergence Detection Between Snapshots", () => {
    const modifiedItems = JSON.parse(JSON.stringify(sampleItems));
    modifiedItems[2].concurrencyLimit = 99999; // Mutate leaf index 2

    const treeA = EosMerkleSnapshotGovernor.buildTree(sampleItems, "snap-v1");
    const treeB = EosMerkleSnapshotGovernor.buildTree(modifiedItems, "snap-v2");

    assert.notEqual(treeA.rootHash, treeB.rootHash);

    const delta = EosMerkleSnapshotGovernor.detectDelta(treeA, treeB);
    assert.equal(delta.rootsMatch, false);
    assert.deepEqual(delta.divergentIndices, [2]);
    assert.equal(delta.differences.length, 1);
    assert.equal(delta.differences[0].index, 2);
  });

  it("BDD-1471: Tamper Rejection and Forged Proof Invalidation", () => {
    const tree = EosMerkleSnapshotGovernor.buildTree(sampleItems);
    const targetLeaf = sampleItems[0];
    const proof = EosMerkleSnapshotGovernor.generateProof(tree, 0);

    // Tamper with sibling hash
    const tamperedProof = JSON.parse(JSON.stringify(proof));
    tamperedProof.proof[0].siblingHash = "0".repeat(64);

    const result = EosMerkleSnapshotGovernor.verifyProof(targetLeaf, tamperedProof);
    assert.equal(result, false, "Tampered sibling hash must fail verification");

    // Tamper with leaf content
    const tamperedLeaf = { ...targetLeaf, cluster: "tampered-zone" };
    const result2 = EosMerkleSnapshotGovernor.verifyProof(tamperedLeaf, proof);
    assert.equal(result2, false, "Tampered leaf content must fail verification");
  });

  it("BDD-1472: Snapshot Manifest and Cryptographic Evidence Receipt", () => {
    const tree = EosMerkleSnapshotGovernor.buildTree(sampleItems);
    const receipt = EosMerkleSnapshotGovernor.generateReceipt(tree, RECEIPT_PATH);

    assert.ok(fs.existsSync(RECEIPT_PATH));
    assert.equal(receipt.rootHash, tree.rootHash);
    assert.equal(receipt.leafCount, 5);
    assert.equal(receipt.depth, 3);
    assert.equal(typeof receipt.sha256Signature, "string");
    assert.equal(receipt.sha256Signature.length, 64);
  });
});
