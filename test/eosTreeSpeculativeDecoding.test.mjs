/**
 * @file eosTreeSpeculativeDecoding.test.mjs
 * @description BDD test suite for SPEC-330 / CHANGE-192: Tree-Structured Speculative
 * Decoding, Multi-Candidate Rejection Sampling & Dynamic Draft Verification Engine (BDD-1755..1760).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosTreeSpeculativeDecodingCore } from "../src/core/eosTreeSpeculativeDecoding.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("TREE_SPECULATIVE_DECODING_RECEIPT.json", ROOT);

test("SPEC-330 / CHANGE-192: Tree-Structured Speculative Decoding & Multi-Candidate Rejection Sampling", async (t) => {
  const engine = new EosTreeSpeculativeDecodingCore(32000, 0.1);

  await t.test("BDD-1755: Draft Tree Topology Construction & Positional Flattening", () => {
    const rootToken = 1000;
    const maxDepth = 3;
    const branching = 2;

    const tree = engine.buildDraftTree(rootToken, maxDepth, branching);

    // Tree nodes: 1 (depth 0) + 2 (depth 1) + 4 (depth 2) + 8 (depth 3) = 15 nodes
    assert.strictEqual(tree.totalNodes, 15, "Total tree nodes must be 15");
    assert.strictEqual(tree.maxDepth, 3);
    assert.strictEqual(tree.flattenedTokenIds.length, 15);
    assert.strictEqual(tree.positionIds.length, 15);
    assert.strictEqual(tree.positionIds[0], 0, "Root depth is 0");
    assert.strictEqual(tree.positionIds[1], 1, "Level 1 depth is 1");
    assert.strictEqual(tree.positionIds[3], 2, "Level 2 depth is 2");
    assert.strictEqual(tree.positionIds[7], 3, "Level 3 depth is 3");
  });

  await t.test("BDD-1756: 2D Causal Tree Attention Mask Ancestry", () => {
    const tree = engine.buildDraftTree(500, 2, 2); // 1 + 2 + 4 = 7 nodes
    const mask = engine.synthesizeTreeAttentionMask(tree);

    assert.strictEqual(mask.dimension, 7);
    assert.strictEqual(mask.maskData.length, 49);

    // Root (index 0) attends only to itself
    assert.strictEqual(mask.maskData[0], 1);
    assert.strictEqual(mask.maskData[1], 0);

    // Node 1 (child of 0) attends to 0 and 1
    assert.strictEqual(mask.maskData[7 + 0], 1, "Node 1 attends to parent 0");
    assert.strictEqual(mask.maskData[7 + 1], 1, "Node 1 attends to itself");
    assert.strictEqual(mask.maskData[7 + 2], 0, "Node 1 does NOT attend to sibling 2");

    // Sibling 2 does not attend to sibling 1
    assert.strictEqual(mask.maskData[14 + 1], 0, "Node 2 does NOT attend to sibling 1");
  });

  await t.test("BDD-1757: Modified Rejection Sampling & Zero KL Divergence Residual", () => {
    // Two-token test case: P(target) = [0.7, 0.3], P(draft) = [0.4, 0.6]
    // Residual for target: max(0, 0.7 - 0.4) = 0.3, max(0, 0.3 - 0.6) = 0.0
    // Normalized residual must place 100% probability on token 0
    const targetDist = new Float32Array([0.7, 0.3]);
    const draftDist = new Float32Array([0.4, 0.6]);

    const sampledToken = engine.sampleFromResidualDistribution(targetDist, draftDist);
    assert.strictEqual(sampledToken, 0, "Recovery token must be sampled from positive residual mass");
  });

  await t.test("BDD-1758: Longest Accepted Path Traversal & Guaranteed Progress (>= 1 token)", () => {
    const tree = engine.buildDraftTree(100, 2, 2); // 7 nodes

    const distributions = tree.nodes.map((n) => {
      const td = new Float32Array(32000);
      const dd = new Float32Array(32000);
      td[n.tokenId] = 0.9;
      dd[n.tokenId] = 0.8;
      return { nodeId: n.nodeId, targetDistribution: td, draftDistribution: dd };
    });

    // RNG sequence that accepts root, accepts node 1, rejects node 3
    const result = engine.verifyTreeWithRejectionSampling(tree, distributions, [0.05, 0.05, 0.99]);

    assert.ok(result.finalEmittedTokens.length >= 1, "Guaranteed progress: >= 1 token emitted");
    assert.ok(result.longestAcceptedPathTokenIds.length >= 1, "Accepted path contains >= 1 token");
    assert.ok(result.speedupEstimate >= 1.0, "Speedup ratio >= 1.0");
    assert.strictEqual(result.zeroKLDivergenceVerified, true);
  });

  await t.test("BDD-1759: Dynamic Tree Modulation (Expand on high alpha, Contract on low alpha)", () => {
    // High acceptance rate (alpha = 0.85) -> EXPAND_TREE
    const expand = engine.modulateTopology(0.85, 3, 2);
    assert.strictEqual(expand.mode, "EXPAND_TREE");
    assert.strictEqual(expand.recommendedDepth, 4);
    assert.strictEqual(expand.recommendedBranchingFactor, 3);
    assert.ok(expand.projectedSpeedup >= 3.0);

    // Medium acceptance rate (alpha = 0.60) -> SUSTAIN
    const sustain = engine.modulateTopology(0.6, 3, 2);
    assert.strictEqual(sustain.mode, "SUSTAIN");
    assert.strictEqual(sustain.recommendedDepth, 3);
    assert.strictEqual(sustain.recommendedBranchingFactor, 2);

    // Low acceptance rate (alpha = 0.25) -> CONTRACT_TREE
    const contract = engine.modulateTopology(0.25, 3, 2);
    assert.strictEqual(contract.mode, "CONTRACT_TREE");
    assert.strictEqual(contract.recommendedDepth, 2);
    assert.strictEqual(contract.recommendedBranchingFactor, 1, "Collapse to linear draft chain");
  });

  await t.test("BDD-1760: Output Identity & Speedup Measurement", () => {
    const tree = engine.buildDraftTree(200, 3, 2);
    const distributions = tree.nodes.map((n) => {
      const td = new Float32Array(32000);
      const dd = new Float32Array(32000);
      td[n.tokenId] = 0.8;
      dd[n.tokenId] = 0.7;
      return { nodeId: n.nodeId, targetDistribution: td, draftDistribution: dd };
    });

    const result = engine.verifyTreeWithRejectionSampling(tree, distributions, [0.1, 0.1, 0.1, 0.1]);
    assert.strictEqual(result.zeroKLDivergenceVerified, true, "Zero KL divergence confirmed");
    assert.ok(result.speedupEstimate >= 2.0, "Theoretical speedup exceeds 2.0x");
  });

  await t.test("Audit Receipt Generation & Cryptographic SHA-256 Seal", () => {
    const receipt = engine.audit(1000, 3, 2);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

    assert.ok(fs.existsSync(RECEIPT_PATH));
    assert.strictEqual(receipt.specRef, "SPEC-330");
    assert.strictEqual(receipt.status, "TREE_SPECULATIVE_DECODING_VERIFIED");
    assert.strictEqual(receipt.treeMaskAncestryVerified, true);
    assert.strictEqual(receipt.guaranteedProgressVerified, true);
    assert.strictEqual(receipt.zeroKLDivergenceVerified, true);
    assert.strictEqual(typeof receipt.sha256Signature, "string");
    assert.strictEqual(receipt.sha256Signature.length, 64);
  });
});
