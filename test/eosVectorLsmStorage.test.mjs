/**
 * BDD Test Suite for SPEC-316 / CHANGE-178:
 * Vector LSM-Tree Segment Storage Engine, Sparse Block Index & Background Compaction
 *
 * Verifies BDD-1671..BDD-1676.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { EosVectorLsmStorageCore } from "../src/core/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence");
const RECEIPT_PATH = path.join(EVIDENCE_DIR, "VECTOR_LSM_STORAGE_RECEIPT.json");

function generateTestVector(dim, seed = 1) {
  const vec = new Float32Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    vec[i] = (s / 4294967296) * 2.0 - 1.0;
  }
  return vec;
}

describe("SPEC-316: Vector LSM-Tree Segment Storage Engine", () => {
  // -------------------------------------------------------------------------
  // BDD-1671: MemTable In-Memory Ingestion, Ordering & Capacity Bounds
  // -------------------------------------------------------------------------
  it("BDD-1671: MemTable In-Memory Ingestion, Ordering & Capacity Bounds", () => {
    const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 50, blockSize: 8 });

    for (let i = 1; i <= 40; i++) {
      const raw = generateTestVector(32, 100 + i);
      lsm.insertVector(`vec-${String(i).padStart(3, "0")}`, raw, { index: i });
    }

    const entries = lsm.getMemTableEntries();
    assert.equal(entries.length, 40);

    const stats = lsm.getStats();
    assert.equal(stats.memTableSize, 40);
    assert.equal(stats.totalLiveVectors, 40);
    assert.equal(stats.totalTombstones, 0);
    assert.equal(stats.latestSequence, 40);

    // Verify properties of stored records
    const sample = entries[0];
    assert.ok(sample.id);
    assert.equal(sample.isTombstone, false);
    assert.equal(sample.vector?.length, 32);
    assert.ok(sample.norm && sample.norm > 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1672: Tombstone Deletion Masking & Point-Lookup Precedence
  // -------------------------------------------------------------------------
  it("BDD-1672: Tombstone Deletion Masking & Point-Lookup Precedence", () => {
    const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 20 });

    lsm.insertVector("target-alpha", generateTestVector(16, 1));
    lsm.insertVector("target-beta", generateTestVector(16, 2));

    // Confirm existence
    assert.ok(lsm.getVector("target-alpha"));
    assert.ok(lsm.getVector("target-beta"));

    // Mask with tombstone
    const tombstone = lsm.deleteVector("target-alpha");
    assert.equal(tombstone.isTombstone, true);

    // Immediate point lookup returns null
    assert.equal(lsm.getVector("target-alpha"), null);
    assert.ok(lsm.getVector("target-beta"));

    // Flush to L0: tombstone must still mask the key
    lsm.flushMemTable();
    assert.equal(lsm.getVector("target-alpha"), null);
    assert.ok(lsm.getVector("target-beta"));
  });

  // -------------------------------------------------------------------------
  // BDD-1673: MemTable Flush to Immutable L0 SSTable with Bloom & Sparse Index
  // -------------------------------------------------------------------------
  it("BDD-1673: MemTable Flush to Immutable L0 SSTable with Bloom & Sparse Index", () => {
    const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 20, blockSize: 5, bloomFilterBits: 512 });

    for (let i = 1; i <= 25; i++) {
      lsm.insertVector(`item-${String(i).padStart(3, "0")}`, generateTestVector(16, 200 + i));
    }

    // Capacity was 20, so 20 items auto-flushed to L0, and 5 remain in MemTable
    const l0Segments = lsm.getL0Segments();
    assert.equal(l0Segments.length, 1);
    const seg = l0Segments[0];

    assert.equal(seg.level, 0);
    assert.equal(seg.totalRecords, 20);
    assert.equal(seg.sparseIndex.length, 4); // 20 / 5 = 4 blocks
    assert.equal(seg.bloomFilter.bitSize, 512);
    assert.equal(seg.minKey, "item-001");
    assert.equal(seg.maxKey, "item-020");

    // Sparse blocks boundaries verify monotonicity
    for (let b = 1; b < seg.sparseIndex.length; b++) {
      assert.ok(seg.sparseIndex[b].firstKey > seg.sparseIndex[b - 1].lastKey);
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1674: Bloom Filter Negative Lookup Short-Circuit and Block Skip Scan
  // -------------------------------------------------------------------------
  it("BDD-1674: Bloom Filter Negative Lookup Short-Circuit and Block Skip Scan", () => {
    const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 100, blockSize: 8 });

    for (let i = 1; i <= 50; i++) {
      lsm.insertVector(`record-${String(i).padStart(3, "0")}`, generateTestVector(32, 400 + i));
    }
    const seg = lsm.flushMemTable();
    assert.ok(seg);

    // Negative lookup: Bloom filter short-circuits
    const mayContainGhost = EosVectorLsmStorageCore.bloomMayContain(seg.bloomFilter, "non-existent-phantom-vector");
    assert.equal(mayContainGhost, false, "Bloom filter must reject distinct non-existent key");
    assert.equal(lsm.getVector("non-existent-phantom-vector"), null);

    // Positive lookup: Sparse index finds correct block
    const t0 = performance.now();
    const hit = lsm.getVector("record-025");
    const elapsedMs = performance.now() - t0;

    assert.ok(hit);
    assert.equal(hit.id, "record-025");
    assert.ok(elapsedMs < 10, `Lookup took too long: ${elapsedMs} ms`);
  });

  // -------------------------------------------------------------------------
  // BDD-1675: Background K-Way Compaction and Tombstone Purging
  // -------------------------------------------------------------------------
  it("BDD-1675: Background K-Way Compaction and Tombstone Purging", () => {
    const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 100, maxL0Segments: 10 });

    // Segment 1: keys 1..5
    for (let i = 1; i <= 5; i++) {
      lsm.insertVector(`key-${i}`, generateTestVector(16, 100 + i));
    }
    lsm.flushMemTable();

    // Segment 2: update key-2, key-3 with new vectors
    lsm.insertVector("key-2", generateTestVector(16, 500));
    lsm.insertVector("key-3", generateTestVector(16, 600));
    lsm.flushMemTable();

    // Segment 3: delete key-1 and key-4
    lsm.deleteVector("key-1");
    lsm.deleteVector("key-4");
    lsm.flushMemTable();

    assert.equal(lsm.getL0Segments().length, 3);

    // Execute compaction to L1
    const l1Seg = lsm.compactL0ToL1();
    assert.ok(l1Seg);
    assert.equal(l1Seg.level, 1);

    // L0 segments must be cleared
    assert.equal(lsm.getL0Segments().length, 0);
    assert.equal(lsm.getL1Segments().length, 1);

    // Tombstones must be completely purged from L1
    assert.equal(l1Seg.totalTombstones, 0);

    // Keys 1 and 4 are deleted; keys 2, 3, 5 remain live (3 total records in L1)
    assert.equal(l1Seg.totalRecords, 3);
    assert.equal(lsm.getVector("key-1"), null);
    assert.equal(lsm.getVector("key-4"), null);
    assert.ok(lsm.getVector("key-2"));
    assert.ok(lsm.getVector("key-3"));
    assert.ok(lsm.getVector("key-5"));
  });

  // -------------------------------------------------------------------------
  // BDD-1676: Segment Structural Audit and Cryptographic SHA-256 Receipt
  // -------------------------------------------------------------------------
  it("BDD-1676: Segment Structural Audit and Cryptographic SHA-256 Receipt", () => {
    const lsm = new EosVectorLsmStorageCore({ memTableCapacity: 10, blockSize: 4 });

    for (let i = 1; i <= 30; i++) {
      lsm.insertVector(`audit-v-${String(i).padStart(3, "0")}`, generateTestVector(16, 700 + i));
    }
    lsm.flushMemTable();

    const receipt = lsm.auditLsmInvariants(EVIDENCE_DIR);

    assert.equal(receipt.specRef, "SPEC-316");
    assert.equal(receipt.status, "VERIFIED");
    assert.ok(receipt.totalLiveVectors >= 30);
    assert.equal(receipt.monotonicityVerified, true);
    assert.ok(receipt.sha256Signature.length === 64);

    // Verify receipt persisted on disk
    assert.ok(fs.existsSync(RECEIPT_PATH), "Receipt file must exist on disk");
    const rawContent = fs.readFileSync(RECEIPT_PATH, "utf8");
    const parsed = JSON.parse(rawContent);

    assert.equal(parsed.specRef, "SPEC-316");
    assert.equal(parsed.sha256Signature, receipt.sha256Signature);

    // Recompute SHA-256 to verify cryptographic authenticity
    const { sha256Signature, ...body } = parsed;
    const computed = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    assert.equal(computed, sha256Signature, "Cryptographic signature must match receipt payload");
  });
});
