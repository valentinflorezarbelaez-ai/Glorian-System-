/**
 * EosZkStateProof Test Suite (SPEC-197 / CHANGE-082)
 *
 * Validates:
 * - Binary Merkle tree construction over salted compliance state leaves
 * - Zero-knowledge selective disclosure audit path generation
 * - Constant-time logarithmic inclusion proof verification against public roots
 * - Tamper detection (modified claim, altered sibling digest, bogus root)
 * - Default repository proof generation and CLI invocation (glorian zk:prove)
 *
 * Strict Layer-0 Purity: Node.js test runner and strict assertions.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EosZkStateProof } from "../src/core/eosZkStateProof.ts";

describe("SPEC-197: EosZkStateProof", () => {
  it("BDD-1004: Binary Merkle tree generation over state leaves", () => {
    const leaves = [
      EosZkStateProof.createLeaf("CLAIM-1", "digest1"),
      EosZkStateProof.createLeaf("CLAIM-2", "digest2"),
      EosZkStateProof.createLeaf("CLAIM-3", "digest3"),
      EosZkStateProof.createLeaf("CLAIM-4", "digest4"),
    ];

    const { root, layers } = EosZkStateProof.buildMerkleTree(leaves);

    assert.equal(typeof root, "string");
    assert.equal(root.length, 64);
    assert.equal(layers.length, 3); // 4 leaves -> 2 pairs -> 1 root
    assert.equal(layers[0].length, 4);
    assert.equal(layers[1].length, 2);
    assert.equal(layers[2].length, 1);
  });

  it("BDD-1005: Zero-Knowledge selective disclosure proof generation", () => {
    const leaves = [
      EosZkStateProof.createLeaf("LAW-V", "zero_runtime_deps", "VERIFIED_COMPLIANT", "salt_v"),
      EosZkStateProof.createLeaf("SPEC-193", "soundcheck_doctor", "VERIFIED_COMPLIANT", "salt_193"),
      EosZkStateProof.createLeaf("SPEC-194", "universal_remediator", "VERIFIED_COMPLIANT", "salt_194"),
      EosZkStateProof.createLeaf("SPEC-196", "swarm_arena", "VERIFIED_COMPLIANT", "salt_196"),
    ];

    const proof = EosZkStateProof.generateInclusionProof(leaves, "SPEC-193");

    assert.equal(proof.claimId, "SPEC-193");
    assert.equal(proof.claimDigest, "soundcheck_doctor");
    assert.equal(proof.salt, "salt_193");
    assert.equal(proof.auditPath.length, 2); // log2(4) = 2 hops
    assert.ok(proof.expectedMerkleRoot.length === 64);
    assert.ok(proof.sha256ProofReceipt.length === 64);

    // Verify adjacent salts are NOT leaked in the proof object
    const serializedProof = JSON.stringify(proof);
    assert.equal(serializedProof.includes("salt_v"), false);
    assert.equal(serializedProof.includes("salt_194"), false);
    assert.equal(serializedProof.includes("salt_196"), false);
  });

  it("BDD-1006: Inclusion proof verification matching public Merkle root", () => {
    const leaves = [
      EosZkStateProof.createLeaf("POLICY-A", "hashA"),
      EosZkStateProof.createLeaf("POLICY-B", "hashB"),
      EosZkStateProof.createLeaf("POLICY-C", "hashC"),
    ];

    const { root } = EosZkStateProof.buildMerkleTree(leaves);
    const proofB = EosZkStateProof.generateInclusionProof(leaves, "POLICY-B");

    const isValid = EosZkStateProof.verifyInclusionProof(proofB, root);
    assert.equal(isValid, true);
  });

  it("BDD-1007: Tampered proof rejection", () => {
    const leaves = [EosZkStateProof.createLeaf("CLAIM-X", "hashX"), EosZkStateProof.createLeaf("CLAIM-Y", "hashY")];

    const { root } = EosZkStateProof.buildMerkleTree(leaves);
    const proof = EosZkStateProof.generateInclusionProof(leaves, "CLAIM-X");

    // 1. Verify authentic proof passes
    assert.equal(EosZkStateProof.verifyInclusionProof(proof, root), true);

    // 2. Tampered claim digest fails
    const tamperedClaimProof = {
      ...proof,
      claimDigest: "forged_digest",
    };
    assert.equal(EosZkStateProof.verifyInclusionProof(tamperedClaimProof, root), false);

    // 3. Tampered sibling hash fails
    const tamperedPathProof = {
      ...proof,
      auditPath: [
        {
          direction: proof.auditPath[0].direction,
          siblingHash: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      ],
    };
    assert.equal(EosZkStateProof.verifyInclusionProof(tamperedPathProof, root), false);

    // 4. Mismatched root fails
    assert.equal(
      EosZkStateProof.verifyInclusionProof(proof, "1111111111111111111111111111111111111111111111111111111111111111"),
      false,
    );
  });

  it("BDD-1008: Cryptographic receipt generation and CLI invocation", () => {
    const root = path.resolve(".");
    const binPath = path.join(root, "bin", "eos.mjs");

    const stdout = execFileSync("node", [binPath, "zk:prove", "--spec=SPEC-193", "--json"], {
      cwd: root,
      encoding: "utf8",
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.verified, true);
    assert.ok(parsed.publicMerkleRoot.length === 64);
    assert.ok(parsed.proof.claimId.includes("SPEC-193"));
    assert.ok(parsed.proof.sha256ProofReceipt.length === 64);
  });
});
