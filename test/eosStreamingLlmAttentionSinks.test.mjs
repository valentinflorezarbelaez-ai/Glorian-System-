/**
 * @file eosStreamingLlmAttentionSinks.test.mjs
 * @description BDD test suite for SPEC-331 / CHANGE-193: StreamingLLM, Attention Sinks
 * & Infinite-Context Window Memory Compression Engine (BDD-1761..1766).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosStreamingLlmCore } from "../src/core/eosStreamingLlmAttentionSinks.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("STREAMING_LLM_ATTENTION_SINKS_RECEIPT.json", ROOT);

test("SPEC-331 / CHANGE-193: StreamingLLM, Attention Sinks & Infinite-Context Window Memory Compression", async (t) => {
  await t.test("BDD-1761: Attention Sink Permanent Allocation & Immutable Residency", () => {
    const engine = new EosStreamingLlmCore(4, 8, 32);

    // Ingest initial 4 tokens
    for (let i = 0; i < 4; i++) {
      const res = engine.ingestToken(1000 + i);
      assert.strictEqual(res.block.isSink, true, `Token ${i} must be marked as sink`);
      assert.strictEqual(res.eviction, null, "No eviction during initial sink population");
    }

    const initialActive = engine.getActiveBlocks();
    assert.strictEqual(initialActive.length, 4);

    // Ingest 50 additional stream tokens
    for (let i = 4; i < 54; i++) {
      engine.ingestToken(1000 + i);
    }

    const currentActive = engine.getActiveBlocks();
    const sinkSubset = currentActive.slice(0, 4);

    assert.strictEqual(sinkSubset.length, 4);
    for (let s = 0; s < 4; s++) {
      assert.strictEqual(sinkSubset[s].tokenId, 1000 + s, `Sink token ${s} must remain unchanged`);
      assert.strictEqual(sinkSubset[s].isSink, true);
      assert.strictEqual(sinkSubset[s].globalPosition, s);
    }
  });

  await t.test("BDD-1762: Constant Memory Ceiling O(K_sink + W_local) under Long Streaming", () => {
    const sinkCap = 4;
    const windowCap = 16;
    const totalCap = sinkCap + windowCap; // 20
    const engine = new EosStreamingLlmCore(sinkCap, windowCap, 32);

    // Stream 1,000 tokens
    for (let i = 0; i < 1000; i++) {
      engine.ingestToken(2000 + i);
      const active = engine.getActiveBlocks();
      assert.ok(active.length <= totalCap, `Active blocks (${active.length}) must not exceed ceiling (${totalCap})`);
    }

    const topology = engine.getCacheTopology();
    assert.strictEqual(topology.currentActiveBlocks, totalCap);
    assert.strictEqual(topology.totalStreamedTokens, 1000);
    assert.strictEqual(topology.totalEvictedTokens, 1000 - totalCap);
  });

  await t.test("BDD-1763: O(1) Rolling Window Eviction with Circular Head Pointers", () => {
    const sinkCap = 2;
    const windowCap = 4;
    const engine = new EosStreamingLlmCore(sinkCap, windowCap, 16);

    // Fill sinks (2) and window (4)
    for (let i = 0; i < 6; i++) {
      const res = engine.ingestToken(500 + i);
      assert.strictEqual(res.eviction, null);
    }

    // Ingest 7th token: triggers eviction of oldest window token (token 502 at pos 2)
    const res7 = engine.ingestToken(506);
    assert.ok(res7.eviction !== null, "Eviction event must be produced");
    assert.strictEqual(res7.eviction.evictedTokenId, 502);
    assert.strictEqual(res7.eviction.evictedGlobalPosition, 2);
    assert.strictEqual(res7.eviction.totalEvictedToDate, 1);
    assert.strictEqual(res7.eviction.wasSinkProtected, true);

    // Ingest 8th token: triggers eviction of next window token (token 503 at pos 3)
    const res8 = engine.ingestToken(507);
    assert.ok(res8.eviction !== null);
    assert.strictEqual(res8.eviction.evictedTokenId, 503);
    assert.strictEqual(res8.eviction.evictedGlobalPosition, 3);
    assert.strictEqual(res8.eviction.totalEvictedToDate, 2);
  });

  await t.test("BDD-1764: Dynamic Contiguous RoPE Re-indexing without Discontinuities", () => {
    const sinkCap = 4;
    const windowCap = 8;
    const engine = new EosStreamingLlmCore(sinkCap, windowCap, 32);

    // Stream 60 tokens so that significant eviction occurs
    for (let i = 0; i < 60; i++) {
      engine.ingestToken(300 + i);
    }

    const rope = engine.computeDynamicRopePositions();
    assert.strictEqual(rope.isContiguousInWindow, true, "Window RoPE positions must be strictly contiguous");
    assert.strictEqual(rope.sinkPositions.length, 4);
    assert.deepStrictEqual(rope.sinkPositions, [0, 1, 2, 3]);

    // Window positions must be [4, 5, 6, 7, 8, 9, 10, 11]
    assert.strictEqual(rope.windowPositions.length, 8);
    for (let i = 0; i < 8; i++) {
      assert.strictEqual(rope.windowPositions[i], 4 + i);
    }
    assert.strictEqual(rope.maxPositionAssigned, 11);
  });

  await t.test("BDD-1765: Softmax Attention Score Stability & Normalization", () => {
    const engine = new EosStreamingLlmCore(4, 16, 32);

    for (let i = 0; i < 100; i++) {
      engine.ingestToken(700 + i);
    }

    const queryKey = new Float32Array(32);
    for (let d = 0; d < 32; d++) {
      queryKey[d] = Math.sin((d + 1) * 0.15);
    }

    const att = engine.computeAttentionScores(queryKey);
    assert.strictEqual(att.isNormalizingStable, true, "Softmax sum must equal 1.0 within numerical epsilon");
    assert.ok(Math.abs(att.totalAttentionSum - 1.0) < 1e-5);
    assert.ok(att.sinkMassFractionPercent > 10.0, "Attention sinks must capture significant attention mass fraction");
    assert.ok(att.attentionEntropy > 0.0, "Entropy must be strictly positive");
  });

  await t.test("BDD-1766: Comprehensive Audit & SHA-256 Cryptographic Receipt", () => {
    const engine = new EosStreamingLlmCore(4, 16, 32);
    const receipt = engine.audit(200, 4, 16);

    assert.strictEqual(receipt.specRef, "SPEC-331");
    assert.strictEqual(receipt.sinkImmunityVerified, true);
    assert.strictEqual(receipt.memoryCeilingVerified, true);
    assert.strictEqual(receipt.ropeContiguityVerified, true);
    assert.strictEqual(receipt.perplexityStabilityVerified, true);
    assert.strictEqual(receipt.status, "STREAMING_LLM_ATTENTION_SINKS_VERIFIED");
    assert.strictEqual(receipt.sha256Signature.length, 64, "SHA-256 signature must be 64 hex characters");

    // Write receipt
    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH), "Receipt file must exist on disk");
  });

  await t.test("Edge Case: Minimalist Topology (K=1, W=1)", () => {
    const engine = new EosStreamingLlmCore(1, 1, 16);
    assert.strictEqual(engine.getTotalCapacity(), 2);

    for (let i = 0; i < 20; i++) {
      engine.ingestToken(900 + i);
      const active = engine.getActiveBlocks();
      if (i > 0) {
        assert.strictEqual(active.length, 2);
      }
      assert.strictEqual(active[0].tokenId, 900, "Permanent sink is immutable");
    }

    const topo = engine.getCacheTopology();
    assert.strictEqual(topo.totalEvictedTokens, 18);
  });

  await t.test("Edge Case: Parameter Boundaries and Default Sanitization", () => {
    const engine = new EosStreamingLlmCore(-5, 0, -10);
    // Negative numbers clamped to >= 1
    assert.strictEqual(engine.getSinkCapacity(), 1);
    assert.strictEqual(engine.getWindowCapacity(), 1);
    assert.strictEqual(engine.getHiddenDim(), 1);
    assert.strictEqual(engine.getTotalCapacity(), 2);
  });
});
