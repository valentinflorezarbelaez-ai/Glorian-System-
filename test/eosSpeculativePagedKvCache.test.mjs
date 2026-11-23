/**
 * EOS System — Speculative Multi-Token Draft Verification & Paged KV-Cache BDD Test Suite
 * SPEC-317 / CHANGE-179
 *
 * Verifies BDD-1677..1682:
 * - BDD-1677: Physical Block Allocation & Virtual Page Table Mapping
 * - BDD-1678: Dynamic Sequence Extension & Free Block Conservation
 * - BDD-1679: Speculative Multi-Token Draft Generation
 * - BDD-1680: Parallel Target Verification & Exact Token Acceptance
 * - BDD-1681: Full Acceptance Fast-Path & Throughput Speedup
 * - BDD-1682: Structural Invariant Audit & Cryptographic Receipt Generation
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { EosSpeculativePagedKvCacheCore } from "../src/core/eosSpeculativePagedKvCache.ts";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("SPECULATIVE_PAGED_KV_CACHE_RECEIPT.json", ROOT);

describe("SPEC-317: Speculative Multi-Token Draft Verification & Paged KV-Cache Engine", () => {
  it("BDD-1677: Physical Block Allocation & Virtual Page Table Mapping", () => {
    const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 64, blockSizeTokens: 16 });

    // Seq 1: 24 tokens -> ceil(24 / 16) = 2 blocks
    const tokensA = Array.from({ length: 24 }, (_, i) => 100 + i);
    const resA = engine.allocateSequence("seq-alpha", tokensA);
    assert.strictEqual(resA.allocatedBlocks, 2);
    assert.strictEqual(resA.pageTable.length, 2);

    // Seq 2: 35 tokens -> ceil(35 / 16) = 3 blocks
    const tokensB = Array.from({ length: 35 }, (_, i) => 200 + i);
    const resB = engine.allocateSequence("seq-beta", tokensB);
    assert.strictEqual(resB.allocatedBlocks, 3);
    assert.strictEqual(resB.pageTable.length, 3);

    // Verify disjoint physical block assignment (no collision)
    const setA = new Set(resA.pageTable);
    const setB = new Set(resB.pageTable);
    assert.strictEqual(setA.size, 2);
    assert.strictEqual(setB.size, 3);
    for (const b of setA) {
      assert.ok(!setB.has(b), `Block ${b} shared between sequences`);
    }

    // Capacity checks
    const seqA = engine.getSequence("seq-alpha");
    assert.ok(seqA);
    assert.strictEqual(seqA.totalCapacityTokens, 32);
    assert.strictEqual(seqA.tokens.length, 24);

    const seqB = engine.getSequence("seq-beta");
    assert.ok(seqB);
    assert.strictEqual(seqB.totalCapacityTokens, 48);
    assert.strictEqual(seqB.tokens.length, 35);
  });

  it("BDD-1678: Dynamic Sequence Extension & Free Block Conservation", () => {
    const total = 16;
    const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: total, blockSizeTokens: 16 });

    // Initial 16 tokens -> exactly 1 block
    const initialTokens = Array.from({ length: 16 }, (_, i) => i + 1);
    engine.allocateSequence("seq-ext", initialTokens);

    let audit = engine.getAuditReport();
    assert.strictEqual(audit.allocatedBlocks, 1);
    assert.strictEqual(audit.freeBlocks, total - 1);
    assert.strictEqual(audit.conservationVerified, true);

    // Append 5 tokens -> requires block 2 (target total 21 tokens)
    const appendRes = engine.appendTokens("seq-ext", [17, 18, 19, 20, 21]);
    assert.strictEqual(appendRes.newBlocksAllocated, 1);
    assert.strictEqual(appendRes.pageTable.length, 2);

    audit = engine.getAuditReport();
    assert.strictEqual(audit.allocatedBlocks, 2);
    assert.strictEqual(audit.freeBlocks, total - 2);
    assert.strictEqual(audit.conservationVerified, true);

    // Free sequence -> all 2 blocks returned to pool
    const freeRes = engine.freeSequence("seq-ext");
    assert.strictEqual(freeRes.reclaimedBlocks, 2);
    assert.strictEqual(freeRes.remainingFreeBlocks, total);

    audit = engine.getAuditReport();
    assert.strictEqual(audit.allocatedBlocks, 0);
    assert.strictEqual(audit.freeBlocks, total);
    assert.strictEqual(audit.conservationVerified, true);
    assert.strictEqual(engine.getSequence("seq-ext"), undefined);
  });

  it("BDD-1679: Speculative Multi-Token Draft Generation", () => {
    const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 32, blockSizeTokens: 16 });
    engine.allocateSequence("seq-draft-eval", [10, 20, 30, 40]);

    const k = 4;
    const draft = engine.generateDraft("seq-draft-eval", k);

    assert.strictEqual(draft.sequenceId, "seq-draft-eval");
    assert.strictEqual(draft.candidateTokens.length, k);
    assert.strictEqual(draft.draftProbabilities.length, k);
    for (const prob of draft.draftProbabilities) {
      assert.ok(prob >= 0.0 && prob <= 1.0, `Probability out of bounds: ${prob}`);
    }
    assert.ok(draft.draftLatencyMs < 5.0, `Draft generation took too long: ${draft.draftLatencyMs} ms`);
  });

  it("BDD-1680: Parallel Target Verification & Exact Token Acceptance", () => {
    const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 32, blockSizeTokens: 16 });
    engine.allocateSequence("seq-verify-test", [10, 20]);

    // Candidates: [100, 200, 300, 400]
    const candidates = [100, 200, 300, 400];

    // Target agrees on 100, 200, 300; diverges on fourth: target predicts 999 instead of 400
    const targetPredictions = [100, 200, 300, 999, 888];
    const verifyResult = engine.verifyDraft("seq-verify-test", candidates, () => targetPredictions);

    // First 3 candidates accepted + target correction token 999
    assert.deepStrictEqual(verifyResult.acceptedTokens, [100, 200, 300]);
    assert.strictEqual(verifyResult.correctionToken, 999);
    assert.deepStrictEqual(verifyResult.totalEmittedTokens, [100, 200, 300, 999]);
    assert.strictEqual(verifyResult.acceptanceRate, 0.75); // 3 / 4 = 0.75
    assert.ok(verifyResult.theoreticalSpeedup > 1.5, `Speedup should exceed 1.5x`);

    // Verify tokens were committed to sequence
    const seq = engine.getSequence("seq-verify-test");
    assert.ok(seq);
    // Initial 2 tokens + 4 emitted = 6 tokens
    assert.deepStrictEqual(seq.tokens, [10, 20, 100, 200, 300, 999]);
  });

  it("BDD-1681: Full Acceptance Fast-Path & Throughput Speedup", () => {
    const engine = new EosSpeculativePagedKvCacheCore({ totalBlocks: 32, blockSizeTokens: 16 });
    engine.allocateSequence("seq-full-accept", [5, 10]);

    const candidates = [50, 60, 70, 80];
    // Target agrees with all 4 candidates and predicts 90 as 5th token
    const targetPredictions = [50, 60, 70, 80, 90];
    const verifyResult = engine.verifyDraft("seq-full-accept", candidates, () => targetPredictions);

    assert.deepStrictEqual(verifyResult.acceptedTokens, [50, 60, 70, 80]);
    assert.strictEqual(verifyResult.correctionToken, 90);
    assert.deepStrictEqual(verifyResult.totalEmittedTokens, [50, 60, 70, 80, 90]);
    assert.strictEqual(verifyResult.acceptanceRate, 1.0); // 100% acceptance
    assert.ok(
      verifyResult.theoreticalSpeedup >= 2.5,
      `Full acceptance speedup should be >= 2.5x, got ${verifyResult.theoreticalSpeedup}x`,
    );

    const seq = engine.getSequence("seq-full-accept");
    assert.ok(seq);
    assert.deepStrictEqual(seq.tokens, [5, 10, 50, 60, 70, 80, 90]);
  });

  it("BDD-1682: Structural Invariant Audit & Cryptographic Receipt Generation", () => {
    // Run CLI audit
    const stdout = execFileSync(
      process.execPath,
      [path.join(ROOT, "bin/eos.mjs"), "toolchain:speculative:audit", "--json"],
      { encoding: "utf8" },
    );

    const receipt = JSON.parse(stdout);
    assert.strictEqual(receipt.specRef, "SPEC-317");
    assert.strictEqual(receipt.changeRef, "CHANGE-179");
    assert.strictEqual(receipt.auditStatus, "VERIFIED");
    assert.strictEqual(receipt.conservationVerified, true);
    assert.strictEqual(receipt.pageTableMonotonicityVerified, true);
    assert.strictEqual(receipt.noSharedBlocksVerified, true);
    assert.ok(typeof receipt.sha256Receipt === "string" && receipt.sha256Receipt.length === 64);

    // Verify receipt written to disk
    assert.ok(fs.existsSync(RECEIPT_PATH), "Receipt file should exist");
    const onDisk = JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8"));
    assert.strictEqual(onDisk.sha256Receipt, receipt.sha256Receipt);
  });
});
