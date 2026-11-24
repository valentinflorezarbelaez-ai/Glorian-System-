/**
 * @file eosDistributedKvReplication.test.mjs
 * @description BDD test suite for SPEC-329 / CHANGE-191: Distributed Key-Value Cache
 * Replication, Prefix Caching & Speculative KV Prefetching Engine (BDD-1749..1754).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosDistributedKvReplicationCore } from "../src/core/eosDistributedKvReplication.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = resolveEvidencePath("DISTRIBUTED_KV_CACHE_REPLICATION_RECEIPT.json", ROOT);

test("SPEC-329 / CHANGE-191: Distributed KV Cache Replication, Prefix Caching & Speculative Prefetching", async (t) => {
  await t.test("BDD-1749: Radix Tree Hierarchical Prefix Matching & Token Prefill Avoidance", () => {
    const engine = new EosDistributedKvReplicationCore(16, 256, 32);
    const systemPrompt = Array.from({ length: 32 }, (_, i) => 1000 + i);

    // Insert 32 tokens (splits into 2 blocks of 16 tokens each)
    const ins = engine.insertPrefix(systemPrompt, true);
    assert.strictEqual(ins.blockIds.length, 2, "Should allocate 2 blocks for 32 tokens");
    assert.strictEqual(ins.allocatedCount, 2, "Allocated count should be 2");
    assert.strictEqual(ins.treeDepth, 2, "Radix tree depth should be 2");

    // Match with prompt containing system prompt + 4 novel tokens
    const query = [...systemPrompt, 9001, 9002, 9003, 9004];
    const match = engine.matchPrefix(query);

    assert.strictEqual(match.matchedTokenCount, 32, "Exact 32 prefix tokens matched");
    assert.strictEqual(match.totalTokenCount, 36, "Total query length is 36");
    assert.strictEqual(match.reusedBlockIds.length, 2, "Reused 2 physical blocks from cache");
    assert.deepStrictEqual(match.reusedBlockIds, ins.blockIds);
    assert.strictEqual(match.newTokensToPrefill.length, 4, "Only 4 new tokens require prefill");
    assert.ok(match.hitRatioPercent > 85.0, `Hit ratio should be > 85%, got ${match.hitRatioPercent}`);
    assert.ok(match.ttftEstimatedSpeedupPercent > 80.0, "TTFT speedup should be > 80%");
  });

  await t.test("BDD-1750: Zero-Copy Physical Block Sharing Across Multi-Turn Sessions", () => {
    const engine = new EosDistributedKvReplicationCore(16, 256, 32);
    const sharedSystemPrompt = Array.from({ length: 32 }, (_, i) => 1000 + i);

    // Insert pinned system prompt
    const baseIns = engine.insertPrefix(sharedSystemPrompt, true);
    assert.strictEqual(engine.getActiveBlockCount(), 2, "2 initial blocks in cache");

    // Session 1: system prompt + user turn 1
    const session1 = [...sharedSystemPrompt, ...Array.from({ length: 16 }, (_, i) => 2000 + i)];
    const ins1 = engine.insertPrefix(session1, false);
    assert.strictEqual(ins1.allocatedCount, 1, "Only 1 novel block allocated for session 1");
    assert.strictEqual(engine.getActiveBlockCount(), 3, "Total blocks is now 3 (2 shared + 1 unique)");

    // Session 2: system prompt + user turn 2 (different tokens)
    const session2 = [...sharedSystemPrompt, ...Array.from({ length: 16 }, (_, i) => 3000 + i)];
    const ins2 = engine.insertPrefix(session2, false);
    assert.strictEqual(ins2.allocatedCount, 1, "Only 1 novel block allocated for session 2");
    assert.strictEqual(engine.getActiveBlockCount(), 4, "Total blocks is now 4 (2 shared + 2 unique)");

    // Verify system blocks are shared zero-copy
    assert.strictEqual(ins1.blockIds[0], baseIns.blockIds[0]);
    assert.strictEqual(ins1.blockIds[1], baseIns.blockIds[1]);
    assert.strictEqual(ins2.blockIds[0], baseIns.blockIds[0]);
    assert.strictEqual(ins2.blockIds[1], baseIns.blockIds[1]);
  });

  await t.test("BDD-1751: Distributed Peer-to-Peer Block Replication & SHA-256 Verification", () => {
    const engine = new EosDistributedKvReplicationCore(16, 128, 32);
    const tokens = Array.from({ length: 16 }, (_, i) => 5000 + i);
    const ins = engine.insertPrefix(tokens, false);
    const blockId = ins.blockIds[0];

    const repEvent = engine.replicateBlock(blockId, "worker-alpha", "worker-beta");

    assert.strictEqual(repEvent.blockId, blockId);
    assert.strictEqual(repEvent.sourceWorkerId, "worker-alpha");
    assert.strictEqual(repEvent.targetWorkerId, "worker-beta");
    assert.strictEqual(repEvent.verifiedMatch, true, "SHA-256 checksum match verified");
    assert.strictEqual(typeof repEvent.sha256Hash, "string");
    assert.strictEqual(repEvent.sha256Hash.length, 64, "SHA-256 hash length is 64 hex chars");

    // Attempting to replicate invalid block throws
    assert.throws(() => {
      engine.replicateBlock("non-existent-block-id", "w1", "w2");
    }, /Cannot replicate non-existent block/);
  });

  await t.test("BDD-1752: Speculative Candidate Branch KV Prefetching into Accelerator Buffers", () => {
    const engine = new EosDistributedKvReplicationCore(16, 256, 32);
    const rootContext = Array.from({ length: 32 }, (_, i) => 6000 + i);
    engine.insertPrefix(rootContext, true);

    // Populate candidate branches
    const candidateBeams = [
      [...rootContext, 7001, 7002],
      [...rootContext, 7010, 7011],
      [...rootContext, 7020, 7021],
    ];

    const prefetch = engine.speculativePrefetch(candidateBeams, 8);

    assert.strictEqual(prefetch.candidateBeamsCount, 3, "3 candidate beams evaluated");
    assert.ok(prefetch.prefetchedBlockIds.length >= 2, "Prefetched common ancestor blocks");
    assert.ok(prefetch.transferredBytes > 0, "Memory bytes calculated for prefetch");
    assert.ok(prefetch.cacheHitProbability > 0.5, "Cache hit probability > 50%");
  });

  await t.test("BDD-1753: Memory Pressure Eviction with Pinned Block Immunity (LRU/LFU)", () => {
    // Engine with tight capacity of 6 blocks
    const capacity = 6;
    const engine = new EosDistributedKvReplicationCore(16, capacity, 32);

    // Insert 2 pinned system blocks (32 tokens)
    const pinnedTokens = Array.from({ length: 32 }, (_, i) => 8000 + i);
    const pinRes = engine.insertPrefix(pinnedTokens, true);
    assert.strictEqual(pinRes.blockIds.length, 2);

    // Insert 4 unpinned blocks (64 tokens) to reach capacity
    for (let i = 0; i < 4; i++) {
      engine.insertPrefix([9000 + i * 16, 9001 + i * 16], false);
    }
    assert.strictEqual(engine.getActiveBlockCount(), 6, "Capacity reached");

    // Evict 3 blocks
    const eviction = engine.evictBlocks(3);

    assert.strictEqual(eviction.requestedBlocks, 3);
    assert.strictEqual(eviction.evictedBlockIds.length, 3);
    assert.strictEqual(eviction.pinnedSkippedCount, 2, "2 pinned blocks were protected");
    assert.strictEqual(eviction.remainingCapacityBlocks, 3, "Capacity restored");

    // Assert neither pinned block was evicted
    for (const pId of pinRes.blockIds) {
      assert.strictEqual(eviction.evictedBlockIds.includes(pId), false, `Pinned block ${pId} must NEVER be evicted`);
    }
  });

  await t.test("BDD-1754: Attention Reconstitution Identity Invariant (epsilon = 0.0)", () => {
    const engine = new EosDistributedKvReplicationCore(16, 64, 32);
    const tokens = Array.from({ length: 16 }, (_, i) => 4000 + i);
    const ins = engine.insertPrefix(tokens, false);
    assert.strictEqual(ins.blockIds.length, 1);
    assert.ok(ins.blockIds[0]);

    // Audit validates exact mathematical identity between cached and fresh KV tensors
    const receipt = engine.audit(3, 4, 32);
    assert.strictEqual(receipt.exactAttentionIdentityVerified, true, "Attention reconstitution epsilon is 0.0");
    assert.strictEqual(receipt.evictionPinnedImmunityVerified, true, "Eviction pinned immunity verified");
    assert.strictEqual(receipt.prefixMatchVerified, true, "Prefix match fast path verified");
    assert.strictEqual(receipt.peerReplicationVerified, true, "Peer replication verified");
    assert.strictEqual(receipt.speculativePrefetchVerified, true, "Speculative prefetch verified");
    assert.strictEqual(receipt.status, "DISTRIBUTED_KV_CACHE_REPLICATION_VERIFIED");
  });

  await t.test("Audit Receipt Generation & SHA-256 Cryptographic Signature", () => {
    const engine = new EosDistributedKvReplicationCore();
    const receipt = engine.audit(4, 5, 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

    assert.ok(fs.existsSync(RECEIPT_PATH), "Receipt file must be saved");
    assert.strictEqual(receipt.specRef, "SPEC-329");
    assert.strictEqual(receipt.status, "DISTRIBUTED_KV_CACHE_REPLICATION_VERIFIED");
    assert.strictEqual(typeof receipt.sha256Signature, "string");
    assert.strictEqual(receipt.sha256Signature.length, 64);
  });
});
