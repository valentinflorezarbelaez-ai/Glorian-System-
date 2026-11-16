/**
 * BDD-1497..BDD-1502: Native SQLite Storage & Semantic Vector Governor Test Suite
 *
 * Validates embedded ACID transactions, WAL mode configuration, FTS5 full-text
 * lexical search, quantized vector BLOB storage, k-NN cosine retrieval,
 * hybrid Reciprocal Rank Fusion (RRF), and cryptographic receipts.
 *
 * Conforms to SPEC-287 / CHANGE-149 and Law V.
 */

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { EosNativeSqliteStore } from "../src/core/eosNativeSqliteStore.ts";

test("BDD-1497: Embedded SQLite initialization and ACID transaction rollback", () => {
  const store = new EosNativeSqliteStore(":memory:");

  // Insert a baseline document
  store.insertDocument({
    id: "base-1",
    category: "constitution",
    title: "Supreme Law",
    content: "All state must be verified and reproducible.",
  });

  assert.ok(store.getDocument("base-1"));

  // Execute a transaction that throws halfway through
  let errorCaught = false;
  try {
    store.transaction(() => {
      store.insertDocument({
        id: "failed-1",
        category: "temp",
        title: "Temp Doc",
        content: "This should be rolled back.",
      });
      throw new Error("Simulated atomic transaction failure");
    });
  } catch {
    errorCaught = true;
  }

  assert.equal(errorCaught, true);
  // failed-1 must NOT exist in the database due to ROLLBACK
  assert.equal(store.getDocument("failed-1"), null);

  store.close();
});

test("BDD-1498: Write-Ahead Logging (WAL) mode enforcement on disk", () => {
  const tmpDir = path.resolve(process.cwd(), "temp", "test-sqlite");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const dbFile = path.join(tmpDir, "wal_test.db");
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }

  const store = new EosNativeSqliteStore(dbFile);
  const audit = store.auditStorage();

  assert.equal(audit.journalMode.toLowerCase(), "wal");
  assert.equal(audit.synchronous, "1");

  store.close();

  // Cleanup
  try {
    fs.unlinkSync(dbFile);
    const walFile = `${dbFile}-wal`;
    const shmFile = `${dbFile}-shm`;
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
  } catch {
    // Ignore transient cleanup errors
  }
});

test("BDD-1499: Full-Text Search (FTS5) BM25 token matching", () => {
  const store = new EosNativeSqliteStore(":memory:");

  store.insertDocument({
    id: "doc-quantum",
    category: "physics",
    title: "Surface Code Quantum Error Correction",
    content: "Surface code rotated lattice topology with minimum weight perfect matching.",
  });

  store.insertDocument({
    id: "doc-orbit",
    category: "space",
    title: "LEO Constellation Optical Routing",
    content: "Laser inter-satellite optical link with Walker-Delta orbital constellation.",
  });

  // Query matching physics
  const resultsPhysics = store.searchFts("Quantum");
  assert.equal(resultsPhysics.length, 1);
  assert.equal(resultsPhysics[0].id, "doc-quantum");

  // Query matching space
  const resultsSpace = store.searchFts("constellation");
  assert.equal(resultsSpace.length, 1);
  assert.equal(resultsSpace[0].id, "doc-orbit");

  store.close();
});

test("BDD-1500: Quantized vector BLOB storage and cosine k-NN retrieval", () => {
  const store = new EosNativeSqliteStore(":memory:");

  // Insert 3 documents with 8-dimensional embedding vectors
  store.insertDocument({
    id: "vec-cluster-a",
    category: "ai",
    title: "Transformer Attention Head",
    content: "Multi-head self-attention mechanisms with scaled dot products.",
    vector: [0.9, 0.85, 0.8, 0.95, 0.1, 0.05, 0.15, 0.2],
  });

  store.insertDocument({
    id: "vec-cluster-b",
    category: "crypto",
    title: "Lattice Cryptography Keygen",
    content: "Learning with Errors over Module Lattices ML-KEM.",
    vector: [0.05, 0.1, 0.15, 0.2, 0.9, 0.85, 0.95, 0.8],
  });

  // Query vector similar to cluster A
  const querySimilarToA = [0.88, 0.8, 0.82, 0.9, 0.12, 0.08, 0.18, 0.15];
  const nearest = store.searchVector(querySimilarToA, 2);

  assert.equal(nearest.length, 2);
  assert.equal(nearest[0].id, "vec-cluster-a");
  assert.ok(nearest[0].similarity > 0.95);
  assert.ok(nearest[0].similarity > nearest[1].similarity);

  store.close();
});

test("BDD-1501: Hybrid lexical and semantic Reciprocal Rank Fusion (RRF)", () => {
  const store = new EosNativeSqliteStore(":memory:");

  store.insertDocument({
    id: "hybrid-1",
    category: "compiler",
    title: "TurboFan JIT Optimizations",
    content: "Monomorphic inlining, escape analysis, and loop peeling in V8.",
    vector: [0.7, 0.6, 0.8, 0.2, 0.1, 0.3, 0.4, 0.5],
  });

  store.insertDocument({
    id: "hybrid-2",
    category: "memory",
    title: "Zero-Allocation Buffer Pools",
    content: "Slab memory allocation and byte scanning with zero heap churn.",
    vector: [0.65, 0.55, 0.75, 0.25, 0.15, 0.35, 0.45, 0.5],
  });

  const queryVec = [0.68, 0.58, 0.78, 0.22, 0.12, 0.32, 0.42, 0.5];
  const hybrid = store.searchHybrid("TurboFan JIT", queryVec, 2);

  assert.equal(hybrid.length, 2);
  assert.equal(hybrid[0].id, "hybrid-1");
  assert.ok(hybrid[0].rrfScore > 0);
  assert.ok(hybrid[0].ftsRank === 1);

  store.close();
});

test("BDD-1502: Cryptographic audit receipt verification", () => {
  const store = new EosNativeSqliteStore(":memory:");

  store.insertDocument({
    id: "receipt-doc-1",
    category: "governance",
    title: "Audit Attestation Test",
    content: "Generating cryptographic evidence for repository verification.",
    vector: [0.5, 0.5, 0.5, 0.5],
  });

  const report = store.auditStorage();

  assert.equal(report.totalDocuments, 1);
  assert.equal(report.fts5Enabled, store.fts5Enabled);
  assert.equal(report.vectorIndexedCount, 1);
  assert.match(report.sha256Signature, /^[a-f0-9]{64}$/);

  const receiptPath = path.resolve(process.cwd(), "docs", "evidence", "SQLITE_STORAGE_RECEIPT.json");
  assert.ok(fs.existsSync(receiptPath));
  const raw = JSON.parse(fs.readFileSync(receiptPath, "utf-8"));
  assert.equal(raw.sha256Signature, report.sha256Signature);

  store.close();
});

test("BDD-1503: Lexical token-rank fallback when FTS5 is compiled out", () => {
  const store = new EosNativeSqliteStore(":memory:", { forceLexicalFallback: true });
  assert.equal(store.fts5Enabled, false);

  store.insertDocument({
    id: "doc-quantum",
    category: "physics",
    title: "Surface Code Quantum Error Correction",
    content: "Surface code rotated lattice topology with minimum weight perfect matching.",
  });
  store.insertDocument({
    id: "doc-orbit",
    category: "space",
    title: "LEO Constellation Optical Routing",
    content: "Laser inter-satellite optical link with Walker-Delta orbital constellation.",
  });

  const resultsPhysics = store.searchFts("Quantum");
  assert.equal(resultsPhysics.length, 1);
  assert.equal(resultsPhysics[0].id, "doc-quantum");
  assert.equal(resultsPhysics[0].rank, 1);

  const hybridStore = new EosNativeSqliteStore(":memory:", { forceLexicalFallback: true });
  hybridStore.insertDocument({
    id: "hybrid-1",
    category: "compiler",
    title: "TurboFan JIT Optimizations",
    content: "Monomorphic inlining, escape analysis, and loop peeling in V8.",
    vector: [0.7, 0.6, 0.8, 0.2, 0.1, 0.3, 0.4, 0.5],
  });
  hybridStore.insertDocument({
    id: "hybrid-2",
    category: "memory",
    title: "Zero-Allocation Buffer Pools",
    content: "Slab memory allocation and byte scanning with zero heap churn.",
    vector: [0.65, 0.55, 0.75, 0.25, 0.15, 0.35, 0.45, 0.5],
  });

  const queryVec = [0.68, 0.58, 0.78, 0.22, 0.12, 0.32, 0.42, 0.5];
  const hybrid = hybridStore.searchHybrid("TurboFan JIT", queryVec, 2);
  assert.equal(hybrid[0].id, "hybrid-1");
  assert.equal(hybrid[0].ftsRank, 1);

  const report = hybridStore.auditStorage();
  assert.equal(report.fts5Enabled, false);

  store.close();
  hybridStore.close();
});
