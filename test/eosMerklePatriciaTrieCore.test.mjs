/**
 * SPEC-229 / CHANGE-114: Layer-0 Modified Merkle Patricia Trie (MPT)
 * Test Suite verifying BDD-1164 through BDD-1168.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosMerklePatriciaTrieCore, EosRlp, EosHexPrefix } from "../src/core/eosMerklePatriciaTrieCore.ts";

test("BDD-1164: Hex-Prefix (Compact) Path Encoding Round-Trip", () => {
  // Test cases: [nibbles, isLeaf]
  const testCases = [
    { nibbles: [1, 2, 3], isLeaf: true, desc: "Odd leaf" },
    { nibbles: [1, 2, 3, 4], isLeaf: true, desc: "Even leaf" },
    { nibbles: [5, 6, 7], isLeaf: false, desc: "Odd extension" },
    { nibbles: [5, 6], isLeaf: false, desc: "Even extension" },
    { nibbles: [0], isLeaf: true, desc: "Single-nibble leaf" },
    { nibbles: [0], isLeaf: false, desc: "Single-nibble extension" },
    { nibbles: [0x0f, 0x0a, 0x0c, 0x0e, 0x01], isLeaf: true, desc: "Hex sequence leaf" },
  ];

  for (const tc of testCases) {
    const encoded = EosHexPrefix.encodePath(tc.nibbles, tc.isLeaf);
    const decoded = EosHexPrefix.decodePath(encoded);
    assert.deepEqual(decoded.nibbles, tc.nibbles, `${tc.desc}: nibbles mismatch`);
    assert.equal(decoded.isLeaf, tc.isLeaf, `${tc.desc}: isLeaf flag mismatch`);
  }

  // RLP round-trip checks
  const shortBuf = Buffer.from("dog", "utf8");
  const encodedShort = EosRlp.encode(shortBuf);
  assert.deepEqual(EosRlp.decode(encodedShort), shortBuf);

  const longBuf = Buffer.alloc(120, 0x42);
  const encodedLong = EosRlp.encode(longBuf);
  assert.deepEqual(EosRlp.decode(encodedLong), longBuf);

  const list = [shortBuf, longBuf, [Buffer.from("nested")]];
  const encodedList = EosRlp.encode(list);
  const decodedList = EosRlp.decode(encodedList);
  assert.ok(Array.isArray(decodedList));
  assert.equal(decodedList.length, 3);
  assert.deepEqual(decodedList[0], shortBuf);
  assert.deepEqual(decodedList[1], longBuf);
});

test("BDD-1165: Merkle Patricia Trie Put and Get State Integrity", () => {
  const trie = new EosMerklePatriciaTrieCore();

  assert.equal(trie.get("non-existent"), null);

  const dataset = [
    { key: "dog", val: "puppy" },
    { key: "doge", val: "coin" },
    { key: "dove", val: "peace" },
    { key: "door", val: "wood" },
    { key: "horse", val: "stallion" },
  ];

  for (const item of dataset) {
    trie.put(item.key, item.val);
  }

  // Retrieve all inserted keys
  for (const item of dataset) {
    const retrieved = trie.get(item.key);
    assert.ok(retrieved !== null, `Key ${item.key} should exist`);
    assert.equal(retrieved.toString("utf8"), item.val);
  }

  // Non-existent keys must return null
  assert.equal(trie.get("cat"), null);
  assert.equal(trie.get("doges"), null);
  assert.equal(trie.get("do"), null);
  assert.equal(trie.get("d"), null);
  assert.equal(trie.get("horses"), null);

  assert.equal(trie.stats().keyCount, 5);
});

test("BDD-1166: Deterministic Root Hash Generation", () => {
  const trie1 = new EosMerklePatriciaTrieCore();
  const trie2 = new EosMerklePatriciaTrieCore();

  const entriesOrderA = [
    { key: "alpha", val: "1" },
    { key: "alphabet", val: "2" },
    { key: "alpine", val: "3" },
    { key: "beta", val: "4" },
    { key: "gamma", val: "5" },
  ];

  const entriesOrderB = [
    { key: "gamma", val: "5" },
    { key: "beta", val: "4" },
    { key: "alphabet", val: "2" },
    { key: "alpha", val: "1" },
    { key: "alpine", val: "3" },
  ];

  for (const item of entriesOrderA) {
    trie1.put(item.key, item.val);
  }
  for (const item of entriesOrderB) {
    trie2.put(item.key, item.val);
  }

  const root1 = trie1.getRootHash();
  const root2 = trie2.getRootHash();

  assert.equal(root1.length, 64, "Root hash must be 32 bytes (64 hex characters)");
  assert.equal(root1, root2, "Permuted insertion orders must produce identical root hashes");
});

test("BDD-1167: Cryptographic Merkle Inclusion Proof Generation & Verification", () => {
  const trie = new EosMerklePatriciaTrieCore();

  trie.put("dog", "puppy");
  trie.put("doge", "coin");
  trie.put("dove", "peace");
  trie.put("door", "wood");

  const rootHash = trie.getRootHash();

  // 1. Valid inclusion proof
  const proofDoge = trie.prove("doge");
  assert.equal(proofDoge.inclusion, true);
  assert.ok(proofDoge.proofNodesHex.length >= 1);

  const verified = EosMerklePatriciaTrieCore.verifyProof(rootHash, "doge", proofDoge.proofNodesHex);
  assert.ok(verified !== null);
  assert.equal(verified.toString("utf8"), "coin");

  // 2. Proof verification for another key
  const proofDove = trie.prove("dove");
  const verifiedDove = EosMerklePatriciaTrieCore.verifyProof(rootHash, "dove", proofDove.proofNodesHex);
  assert.ok(verifiedDove !== null);
  assert.equal(verifiedDove.toString("utf8"), "peace");

  // 3. Exclusion proof for non-existent key
  const proofCat = trie.prove("cat");
  const verifiedCat = EosMerklePatriciaTrieCore.verifyProof(rootHash, "cat", proofCat.proofNodesHex);
  assert.equal(verifiedCat, null, "Non-existent key verification must return null");

  // 4. Corrupted proof must fail
  assert.throws(() => {
    // Modify root proof node
    const corruptedProof = [...proofDoge.proofNodesHex];
    corruptedProof[0] = "deadbeef" + corruptedProof[0].slice(8);
    EosMerklePatriciaTrieCore.verifyProof(rootHash, "doge", corruptedProof);
  });
});

test("BDD-1168: Key Deletion and Structural Compaction", () => {
  const trie = new EosMerklePatriciaTrieCore();

  trie.put("test", "first-value");
  trie.put("team", "second-value");

  assert.equal(trie.get("test")?.toString("utf8"), "first-value");
  assert.equal(trie.get("team")?.toString("utf8"), "second-value");
  assert.equal(trie.stats().keyCount, 2);

  const deleted = trie.delete("team");
  assert.equal(deleted, true);

  // "team" is gone
  assert.equal(trie.get("team"), null);
  // "test" still exists
  assert.equal(trie.get("test")?.toString("utf8"), "first-value");
  assert.equal(trie.stats().keyCount, 1);

  // Deleting non-existent key returns false
  assert.equal(trie.delete("team"), false);

  // Structure should now be compacted into a single leaf
  assert.equal(trie.stats().rootType, "leaf");

  // Deleting remaining key yields empty trie
  trie.delete("test");
  assert.equal(trie.get("test"), null);
  assert.equal(trie.stats().keyCount, 0);
  assert.equal(trie.stats().rootType, "null");
});
