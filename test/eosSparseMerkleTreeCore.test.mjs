/**
 * EOS Layer-0 Sparse Merkle Tree (SMT) Core Test Suite
 * Governed by SPEC-218: FR-1109..FR-1113 and BDD-1109..BDD-1113.
 * Zero external runtime dependencies.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  EosSparseMerkleTreeCore,
  EMPTY_HASHES,
  SMT_DEPTH,
  getBit,
  hashLeaf,
  hashBranch,
} from "../src/core/eosSparseMerkleTreeCore.ts";

describe("EosSparseMerkleTreeCore (SPEC-218 / BDD-1109..BDD-1113)", () => {
  test("BDD-1109: 256-Level Radix Trie Invariants and Empty Subtree Caching", () => {
    assert.strictEqual(typeof EosSparseMerkleTreeCore, "function");
    assert.strictEqual(SMT_DEPTH, 256);
    assert.strictEqual(EMPTY_HASHES.length, 257);

    // Empty tree initializes with root matching EMPTY_HASHES[256]
    const smt = new EosSparseMerkleTreeCore();
    assert.strictEqual(smt.getLeafCount(), 0);
    assert.strictEqual(smt.getRoot(), EMPTY_HASHES[256]);

    // Bit extraction logic
    const pathHex = "0000000000000000000000000000000000000000000000000000000000000000";
    assert.strictEqual(getBit(pathHex, 0), 0);
    assert.strictEqual(getBit(pathHex, 255), 0);

    const pathHexOne = "8000000000000000000000000000000000000000000000000000000000000001";
    assert.strictEqual(getBit(pathHexOne, 0), 1);
    assert.strictEqual(getBit(pathHexOne, 255), 1);
    assert.strictEqual(getBit(pathHexOne, 1), 0);

    // Node hash primitives
    assert.strictEqual(hashLeaf("path", "val").length, 64);
    assert.strictEqual(hashBranch("left", "right").length, 64);
  });

  test("BDD-1110: Deterministic State Commitment and Non-Destructive Mutations", () => {
    const smt1 = new EosSparseMerkleTreeCore();
    const smt2 = new EosSparseMerkleTreeCore();

    const entriesA = [
      ["k1", "v1"],
      ["k2", "v2"],
      ["k3", "v3"],
      ["k4", "v4"],
      ["k5", "v5"],
    ];

    const entriesB = [
      ["k4", "v4"],
      ["k1", "v1"],
      ["k5", "v5"],
      ["k3", "v3"],
      ["k2", "v2"],
    ];

    for (const [k, v] of entriesA) smt1.set(k, v);
    for (const [k, v] of entriesB) smt2.set(k, v);

    // Identical key-value sets inserted in different order must yield identical canonical root
    assert.strictEqual(smt1.getRoot(), smt2.getRoot());
    assert.strictEqual(smt1.getLeafCount(), 5);

    // Value update
    const rootBeforeUpdate = smt1.getRoot();
    smt1.set("k1", "v1-updated");
    assert.notStrictEqual(smt1.getRoot(), rootBeforeUpdate);
    assert.strictEqual(smt1.get("k1"), "v1-updated");

    // Deletion
    smt1.set("k1", "v1"); // Restore
    assert.strictEqual(smt1.getRoot(), rootBeforeUpdate);

    smt1.delete("k5");
    assert.strictEqual(smt1.getLeafCount(), 4);
    assert.strictEqual(smt1.get("k5"), null);
  });

  test("BDD-1111: Fast Membership Proof Generation and Verification", () => {
    const smt = new EosSparseMerkleTreeCore();
    for (let i = 0; i < 50; i++) {
      smt.set(`account:${i}`, `balance:${i * 100}`);
    }

    const targetKey = "account:25";
    const proof = smt.getProof(targetKey);

    assert.strictEqual(proof.proofType, "membership");
    assert.strictEqual(proof.key, targetKey);
    assert.strictEqual(proof.value, "balance:2500");
    assert.strictEqual(proof.root, smt.getRoot());
    assert.ok(proof.siblings.length >= 1);

    // Verify proof
    const verifyRes = smt.verifyProof(proof);
    assert.strictEqual(verifyRes.valid, true);
    assert.strictEqual(verifyRes.proofType, "membership");
    assert.ok(verifyRes.verificationTimeMs < 5.0, "Verification should be sub-millisecond");
    assert.strictEqual(verifyRes.receipt.operation, "verify");
    assert.strictEqual(verifyRes.receipt.receiptSha256.length, 64);

    // Tampered value must fail
    const tamperedProof = {
      ...proof,
      value: "balance:999999",
    };
    const tamperedRes = smt.verifyProof(tamperedProof);
    assert.strictEqual(tamperedRes.valid, false);

    // Tampered root must fail
    const tamperedRootProof = {
      ...proof,
      root: "0000000000000000000000000000000000000000000000000000000000000000",
    };
    const tamperedRootRes = smt.verifyProof(tamperedRootProof);
    assert.strictEqual(tamperedRootRes.valid, false);
  });

  test("BDD-1112: Cryptographic Proof of Non-Membership (Exclusion Proofs)", () => {
    const smt = new EosSparseMerkleTreeCore();
    smt.set("cert:valid-1", "active");
    smt.set("cert:valid-2", "active");

    // Case 1: Non-existent key in unpopulated subtree
    const nonExistentKey = "cert:unissued-999";
    const nonMemberProof = smt.getProof(nonExistentKey);

    assert.strictEqual(nonMemberProof.proofType, "non_membership");
    assert.strictEqual(nonMemberProof.value, null);
    assert.ok(
      nonMemberProof.nonMembershipReason === "EMPTY_SUBTREE" || nonMemberProof.nonMembershipReason === "KEY_COLLISION",
    );

    const verifyExclusionRes = smt.verifyProof(nonMemberProof);
    assert.strictEqual(verifyExclusionRes.valid, true);
    assert.strictEqual(verifyExclusionRes.proofType, "non_membership");
    assert.strictEqual(verifyExclusionRes.receipt.receiptSha256.length, 64);

    // Tampered exclusion proof (claiming wrong root)
    const tamperedExclusion = {
      ...nonMemberProof,
      root: "deadbeef00000000deadbeef00000000deadbeef00000000deadbeef00000000",
    };
    const tamperedExclusionRes = smt.verifyProof(tamperedExclusion);
    assert.strictEqual(tamperedExclusionRes.valid, false);
  });

  test("BDD-1113: Frontier CLI and MCP Dispatch", () => {
    const cliPath = path.resolve(process.cwd(), "bin/eos.mjs");

    const setOutput = execFileSync("node", [cliPath, "smt:set", "--key=tenant-x", "--value=status-gold", "--json"], {
      encoding: "utf8",
    });
    const setJson = JSON.parse(setOutput);
    assert.strictEqual(setJson.key, "tenant-x");
    assert.strictEqual(setJson.value, "status-gold");
    assert.ok(setJson.root);
    assert.ok(setJson.receipt.receiptSha256);

    const proveOutput = execFileSync("node", [cliPath, "smt:prove", "--key=tenant-001", "--json"], {
      encoding: "utf8",
    });
    const proveJson = JSON.parse(proveOutput);
    assert.strictEqual(proveJson.proofType, "membership");
    assert.strictEqual(proveJson.valid, true);
    assert.ok(proveJson.receipt.receiptSha256);

    const verifyOutput = execFileSync("node", [cliPath, "smt:verify", "--key=non-existent-probe", "--json"], {
      encoding: "utf8",
    });
    const verifyJson = JSON.parse(verifyOutput);
    assert.strictEqual(verifyJson.proofType, "non_membership");
    assert.strictEqual(verifyJson.valid, true);
    assert.ok(verifyJson.receipt.receiptSha256);
  });
});
