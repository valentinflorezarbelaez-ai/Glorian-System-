/**
 * EOS SYSTEM — MONOTONIC HASH CHAIN TESTS
 * Tests for pureSha256, MonotonicClock, HashChainBlock, EosMonotonicHashChain
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  pureSha256,
  MonotonicClock,
  HashChainBlock,
  EosMonotonicHashChain,
  GENESIS_PREVIOUS_HASH,
} from "../src/core/eosMonotonicHashChain.ts";

// ============================================================================
// pureSha256
// ============================================================================

test("pureSha256 returns 64 hex characters", () => {
  const hash = pureSha256("hello");
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("pureSha256 is deterministic", () => {
  const a = pureSha256("test");
  const b = pureSha256("test");
  assert.equal(a, b);
});

test("pureSha256 empty string", () => {
  const hash = pureSha256("");
  const expected = createHash("sha256").update("").digest("hex");
  assert.equal(hash, expected);
});

test("pureSha256 matches node:crypto for ASCII", () => {
  const input = "hello world";
  const pure = pureSha256(input);
  const expected = createHash("sha256").update(input).digest("hex");
  assert.equal(pure, expected);
});

test("pureSha256 matches node:crypto for single character", () => {
  const input = "A";
  const pure = pureSha256(input);
  const expected = createHash("sha256").update(input).digest("hex");
  assert.equal(pure, expected);
});

test("pureSha256 matches node:crypto for longer string", () => {
  const input = "The quick brown fox jumps over the lazy dog";
  const pure = pureSha256(input);
  const expected = createHash("sha256").update(input).digest("hex");
  assert.equal(pure, expected);
});

test("pureSha256 different inputs produce different hashes", () => {
  const a = pureSha256("input1");
  const b = pureSha256("input2");
  assert.notEqual(a, b);
});

test("pureSha256 handles numbers as strings", () => {
  const hash = pureSha256("12345");
  assert.equal(hash.length, 64);
});

// ============================================================================
// MonotonicClock
// ============================================================================

test("MonotonicClock now() returns wallClockIso string", () => {
  const clock = new MonotonicClock();
  const ts = clock.now();
  assert.equal(typeof ts.wallClockIso, "string");
  assert.ok(ts.wallClockIso.length > 0);
});

test("MonotonicClock now() returns monotonicNs bigint", () => {
  const clock = new MonotonicClock();
  const ts = clock.now();
  assert.equal(typeof ts.monotonicNs, "bigint");
});

test("MonotonicClock now() returns sequenceIndex number", () => {
  const clock = new MonotonicClock();
  const ts = clock.now();
  assert.equal(typeof ts.sequenceIndex, "number");
  assert.equal(ts.sequenceIndex, 1);
});

test("MonotonicClock sequenceIndex increments", () => {
  const clock = new MonotonicClock();
  clock.now();
  clock.now();
  const ts3 = clock.now();
  assert.equal(ts3.sequenceIndex, 3);
});

test("MonotonicClock monotonicNs never decreases", () => {
  const clock = new MonotonicClock();
  let prev = 0n;
  for (let i = 0; i < 100; i++) {
    const ts = clock.now();
    assert.ok(ts.monotonicNs >= prev);
    prev = ts.monotonicNs;
  }
});

test("MonotonicClock reset clears sequence", () => {
  const clock = new MonotonicClock();
  clock.now();
  clock.now();
  clock.reset();
  const ts = clock.now();
  assert.equal(ts.sequenceIndex, 1);
});

test("MonotonicClock reset with initialNs", () => {
  const clock = new MonotonicClock();
  clock.reset(100n);
  const ts = clock.now();
  assert.ok(ts.monotonicNs >= 100n);
});

test("MonotonicClock custom monotonicProvider", () => {
  let counter = 1000n;
  const clock = new MonotonicClock({
    monotonicProvider: () => counter,
  });
  const ts = clock.now();
  assert.ok(ts.monotonicNs >= 1000n);
});

test("MonotonicClock custom wallClockProvider", () => {
  const clock = new MonotonicClock({
    wallClockProvider: () => "2024-01-01T00:00:00.000Z",
  });
  const ts = clock.now();
  assert.equal(ts.wallClockIso, "2024-01-01T00:00:00.000Z");
});

test("MonotonicClock guarantees monotonicity with constant provider", () => {
  const clock = new MonotonicClock({
    monotonicProvider: () => 500n,
  });
  const ts1 = clock.now();
  const ts2 = clock.now();
  const ts3 = clock.now();
  assert.ok(ts1.monotonicNs < ts2.monotonicNs);
  assert.ok(ts2.monotonicNs < ts3.monotonicNs);
});

test("MonotonicClock initialNs option", () => {
  const clock = new MonotonicClock({ initialNs: 999n });
  const ts = clock.now();
  assert.ok(ts.monotonicNs >= 999n);
});

test("MonotonicClock now() returns frozen object", () => {
  const clock = new MonotonicClock();
  const ts = clock.now();
  assert.equal(Object.isFrozen(ts), true);
});

// ============================================================================
// HashChainBlock — computeHash
// ============================================================================

test("HashChainBlock.computeHash is deterministic", () => {
  const h1 = HashChainBlock.computeHash(0, "prev", "payload", 100n);
  const h2 = HashChainBlock.computeHash(0, "prev", "payload", 100n);
  assert.equal(h1, h2);
});

test("HashChainBlock.computeHash returns 64 hex chars", () => {
  const h = HashChainBlock.computeHash(0, "prev", "payload", 100n);
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]{64}$/);
});

test("HashChainBlock.computeHash different params produce different hash", () => {
  const h1 = HashChainBlock.computeHash(0, "prev", "payload", 100n);
  const h2 = HashChainBlock.computeHash(1, "prev", "payload", 100n);
  assert.notEqual(h1, h2);
});

// ============================================================================
// HashChainBlock — createGenesis
// ============================================================================

test("HashChainBlock.createGenesis creates index 0", () => {
  const block = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  assert.equal(block.index, 0);
});

test("HashChainBlock.createGenesis uses GENESIS_PREVIOUS_HASH", () => {
  const block = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  assert.equal(block.previousHash, GENESIS_PREVIOUS_HASH);
});

test("HashChainBlock.createGenesis currentHash is 64 hex chars", () => {
  const block = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  assert.equal(block.currentHash.length, 64);
});

test("HashChainBlock constructor throws on negative index", () => {
  assert.throws(
    () => {
      new HashChainBlock({
        index: -1,
        previousHash: GENESIS_PREVIOUS_HASH,
        payload: { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
        wallClockIso: "2024-01-01T00:00:00.000Z",
        monotonicNs: 100n,
      });
    },
    { message: /index cannot be negative/ },
  );
});

test("HashChainBlock constructor throws on genesis with wrong previousHash", () => {
  assert.throws(
    () => {
      new HashChainBlock({
        index: 0,
        previousHash: "wrong_hash",
        payload: { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
        wallClockIso: "2024-01-01T00:00:00.000Z",
        monotonicNs: 100n,
      });
    },
    { message: /Genesis block/ },
  );
});

test("HashChainBlock is frozen", () => {
  const block = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  assert.equal(Object.isFrozen(block), true);
});

// ============================================================================
// HashChainBlock — createNextBlock
// ============================================================================

test("HashChainBlock.createNextBlock increments index", () => {
  const genesis = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  const next = HashChainBlock.createNextBlock(
    genesis,
    { recordId: "r2", type: "t2", payloadHash: "ph2", summary: "s2" },
    "2024-01-01T00:00:01.000Z",
    200n,
  );
  assert.equal(next.index, 1);
});

test("HashChainBlock.createNextBlock links previousHash", () => {
  const genesis = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  const next = HashChainBlock.createNextBlock(
    genesis,
    { recordId: "r2", type: "t2", payloadHash: "ph2", summary: "s2" },
    "2024-01-01T00:00:01.000Z",
    200n,
  );
  assert.equal(next.previousHash, genesis.currentHash);
});

test("HashChainBlock.createNextBlock throws on time decrease", () => {
  const genesis = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    200n,
  );
  assert.throws(
    () => {
      HashChainBlock.createNextBlock(
        genesis,
        { recordId: "r2", type: "t2", payloadHash: "ph2", summary: "s2" },
        "2024-01-01T00:00:01.000Z",
        100n,
      );
    },
    { message: /Monotonic time cannot decrease/ },
  );
});

test("HashChainBlock.createNextBlock allows equal monotonic time", () => {
  const genesis = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  const next = HashChainBlock.createNextBlock(
    genesis,
    { recordId: "r2", type: "t2", payloadHash: "ph2", summary: "s2" },
    "2024-01-01T00:00:01.000Z",
    100n,
  );
  assert.equal(next.index, 1);
});

// ============================================================================
// HashChainBlock — verifyChain
// ============================================================================

test("HashChainBlock.verifyChain empty array is valid", () => {
  const result = HashChainBlock.verifyChain([]);
  assert.equal(result.valid, true);
  assert.equal(result.totalBlocks, 0);
});

test("HashChainBlock.verifyChain single genesis block is valid", () => {
  const chain = new EosMonotonicHashChain();
  chain.append("r1", "t1", "s1");
  const blocks = chain.getBlocks();
  const result = HashChainBlock.verifyChain(blocks);
  assert.equal(result.valid, true);
  assert.equal(result.totalBlocks, 1);
});

test("HashChainBlock.verifyChain valid chain of 3 blocks", () => {
  const chain = new EosMonotonicHashChain();
  chain.append("r1", "t1", "s1");
  chain.append("r2", "t2", "s2");
  chain.append("r3", "t3", "s3");
  const blocks = chain.getBlocks();
  const result = HashChainBlock.verifyChain(blocks);
  assert.equal(result.valid, true);
  assert.equal(result.totalBlocks, 3);
});

test("HashChainBlock.verifyChain detects non-genesis first block", () => {
  const b = HashChainBlock.createNextBlock(
    HashChainBlock.createGenesis(
      { recordId: "r0", type: "t0", payloadHash: "ph0", summary: "s0" },
      "2024-01-01T00:00:00.000Z",
      50n,
    ),
    { recordId: "r2", type: "t2", payloadHash: "ph2", summary: "s2" },
    "2024-01-01T00:00:01.000Z",
    200n,
  );
  const result = HashChainBlock.verifyChain([b]);
  assert.equal(result.valid, false);
  assert.ok(result.reason);
});

test("HashChainBlock.verifyChain result is frozen", () => {
  const result = HashChainBlock.verifyChain([]);
  assert.equal(Object.isFrozen(result), true);
});

// ============================================================================
// HashChainBlock — toJSON / fromJSON
// ============================================================================

test("HashChainBlock.toJSON returns correct structure", () => {
  const block = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  const json = block.toJSON();
  assert.equal(json.index, 0);
  assert.equal(json.previousHash, GENESIS_PREVIOUS_HASH);
  assert.equal(typeof json.monotonicNs, "string");
  assert.equal(json.monotonicNs, "100");
});

test("HashChainBlock.fromJSON round-trip", () => {
  const block = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1" },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  const json = block.toJSON();
  const restored = HashChainBlock.fromJSON(json);
  assert.equal(restored.index, block.index);
  assert.equal(restored.previousHash, block.previousHash);
  assert.equal(restored.currentHash, block.currentHash);
  assert.equal(restored.monotonicNs, block.monotonicNs);
});

test("HashChainBlock.fromJSON preserves payload", () => {
  const block = HashChainBlock.createGenesis(
    { recordId: "r1", type: "t1", payloadHash: "ph1", summary: "s1", metadata: { key: "val" } },
    "2024-01-01T00:00:00.000Z",
    100n,
  );
  const json = block.toJSON();
  const restored = HashChainBlock.fromJSON(json);
  assert.equal(restored.payload.recordId, "r1");
  assert.equal(restored.payload.metadata?.key, "val");
});

// ============================================================================
// EosMonotonicHashChain
// ============================================================================

test("EosMonotonicHashChain append creates genesis block", () => {
  const chain = new EosMonotonicHashChain();
  const block = chain.append("r1", "t1", "s1");
  assert.equal(block.index, 0);
  assert.equal(block.previousHash, GENESIS_PREVIOUS_HASH);
});

test("EosMonotonicHashChain append creates next block", () => {
  const chain = new EosMonotonicHashChain();
  chain.append("r1", "t1", "s1");
  const block2 = chain.append("r2", "t2", "s2");
  assert.equal(block2.index, 1);
});

test("EosMonotonicHashChain verify after append", () => {
  const chain = new EosMonotonicHashChain();
  chain.append("r1", "t1", "s1");
  chain.append("r2", "t2", "s2");
  const result = chain.verify();
  assert.equal(result.valid, true);
  assert.equal(result.totalBlocks, 2);
});

test("EosMonotonicHashChain getBlocks returns blocks", () => {
  const chain = new EosMonotonicHashChain();
  chain.append("r1", "t1", "s1");
  chain.append("r2", "t2", "s2");
  const blocks = chain.getBlocks();
  assert.equal(blocks.length, 2);
});

test("EosMonotonicHashChain getLatestBlock returns null when empty", () => {
  const chain = new EosMonotonicHashChain();
  assert.equal(chain.getLatestBlock(), null);
});

test("EosMonotonicHashChain getLatestBlock returns last block", () => {
  const chain = new EosMonotonicHashChain();
  chain.append("r1", "t1", "s1");
  const latest = chain.getLatestBlock();
  assert.ok(latest);
  assert.equal(latest.index, 0);
});

test("EosMonotonicHashChain toJSON returns array", () => {
  const chain = new EosMonotonicHashChain();
  chain.append("r1", "t1", "s1");
  const json = chain.toJSON();
  assert.ok(Array.isArray(json));
  assert.equal(json.length, 1);
});

test("EosMonotonicHashChain loadFromJSON restores blocks", () => {
  const chain1 = new EosMonotonicHashChain();
  chain1.append("r1", "t1", "s1");
  chain1.append("r2", "t2", "s2");
  const json = chain1.toJSON();

  const chain2 = new EosMonotonicHashChain();
  chain2.loadFromJSON(json);
  assert.equal(chain2.getBlocks().length, 2);
  assert.equal(chain2.getLatestBlock().index, 1);
});

test("EosMonotonicHashChain loadFromJSON then append continues chain", () => {
  const chain1 = new EosMonotonicHashChain();
  chain1.append("r1", "t1", "s1");
  const json = chain1.toJSON();

  const chain2 = new EosMonotonicHashChain();
  chain2.loadFromJSON(json);
  const newBlock = chain2.append("r3", "t3", "s3");
  assert.equal(newBlock.index, 1);
  const result = chain2.verify();
  assert.equal(result.valid, true);
});

test("EosMonotonicHashChain custom clock", () => {
  const clock = new MonotonicClock({ initialNs: 5000n });
  const chain = new EosMonotonicHashChain({ clock });
  const block = chain.append("r1", "t1", "s1");
  assert.ok(block.monotonicNs >= 5000n);
});

test("EosMonotonicHashChain append with metadata", () => {
  const chain = new EosMonotonicHashChain();
  const block = chain.append("r1", "t1", "s1", { extra: "data" });
  assert.equal(block.payload.recordId, "r1");
  assert.equal(block.payload.metadata?.extra, "data");
});

test("EosMonotonicHashChain verify empty chain", () => {
  const chain = new EosMonotonicHashChain();
  const result = chain.verify();
  assert.equal(result.valid, true);
  assert.equal(result.totalBlocks, 0);
});

test("GENESIS_PREVIOUS_HASH is 64 zeros", () => {
  assert.equal(GENESIS_PREVIOUS_HASH, "0".repeat(64));
});
