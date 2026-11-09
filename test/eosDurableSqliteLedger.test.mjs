/**
 * EOS SYSTEM — SPEC-064 BDD TEST SUITE
 * Durable SQLite WAL Sovereign Ledger Engine
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

test("BDD-220: Durable SQLite Ledger Creation and Sequential Append", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ledger-test-"));
  const dbPath = path.join(tmpDir, "ledger.sqlite");

  try {
    const ledger = new EosDurableSqliteLedger(dbPath);

    // Append first entry
    const entry1 = ledger.appendEntry({
      category: "DECISION_RECORD",
      projectId: "eos-core",
      title: "ADR-001: Adopt Hexagonal Layer 0",
      payload: { decision: "APPROVED", layers: 3 },
      engramTopicKey: "architecture/adr-001",
    });

    assert.equal(entry1.seq, 1);
    assert.ok(entry1.entryId.startsWith("EOS-LEDGER-000001-"));
    assert.equal(entry1.prevHash, "0".repeat(64));
    assert.equal(entry1.entryHash.length, 64);
    assert.equal(entry1.category, "DECISION_RECORD");

    // Append second entry with explicit entryId and createdAtIso
    const customTime = new Date(1700000000000).toISOString();
    const entry2 = ledger.appendEntry({
      entryId: "CUSTOM-ID-002",
      category: "SECURITY_AUDIT",
      projectId: "eos-core",
      title: "SEC-001: Zero Secrets Scan Clean",
      payload: { vulnerabilities: 0 },
      createdAtIso: customTime,
    });

    assert.equal(entry2.seq, 2);
    assert.equal(entry2.entryId, "CUSTOM-ID-002");
    assert.equal(entry2.prevHash, entry1.entryHash);
    assert.equal(entry2.createdAtIso, customTime);

    // List recent
    const recent = ledger.listRecent(10);
    assert.equal(recent.length, 2);
    assert.equal(recent[0].seq, 2); // Reverse order
    assert.equal(recent[1].seq, 1);

    // Filter by projectId
    const filtered = ledger.listRecent(10, "eos-core");
    assert.equal(filtered.length, 2);
    const emptyFilter = ledger.listRecent(10, "non-existent-proj");
    assert.equal(emptyFilter.length, 0);

    ledger.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-221: Ledger Search and FTS5 Sanitization", () => {
  const ledger = new EosDurableSqliteLedger(":memory:");

  ledger.appendEntry({
    category: "RESEARCH_INTEL",
    projectId: "alpha",
    title: "Quantum Entanglement in Microservices",
    payload: { tags: ["quantum", "research"] },
  });
  ledger.appendEntry({
    category: "VERIFICATION_RECEIPT",
    projectId: "beta",
    title: "Vercel Canary Verification Report",
    payload: { status: "PASS", errorRate: 0.0001 },
  });

  // Search by exact token
  const search1 = ledger.searchEntries("Quantum");
  assert.ok(search1.length >= 1);
  assert.equal(search1[0].projectId, "alpha");

  // Search with special punctuation (sanitization test: punctuation won't crash FTS5)
  const searchPunct = ledger.searchEntries("Vercel - Canary:");
  assert.ok(searchPunct.length >= 1);
  assert.equal(searchPunct[0].projectId, "beta");

  // Search empty/whitespace query returns listRecent
  const searchEmpty = ledger.searchEntries("   ");
  assert.equal(searchEmpty.length, 2);

  // Search query with no matches
  const searchNone = ledger.searchEntries("NonExistentTermXYZ999");
  assert.equal(searchNone.length, 0);

  // Get entries up to sequence K
  const upTo1 = ledger.getEntriesUpTo(1);
  assert.equal(upTo1.length, 1);
  assert.equal(upTo1[0].seq, 1);

  assert.throws(() => ledger.getEntriesUpTo(0), /maxSeq must be >= 1/);

  ledger.close();
});

test("BDD-222: Cryptographic Chain Integrity and Tamper Detection", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ledger-tamper-"));
  const dbPath = path.join(tmpDir, "tamper.sqlite");

  try {
    const ledger = new EosDurableSqliteLedger(dbPath);

    for (let i = 1; i <= 3; i++) {
      ledger.appendEntry({
        category: "ARCHITECTURE_DECISION",
        projectId: "fleet",
        title: `Decision ${i}`,
        payload: { step: i },
      });
    }

    // Verify pristine chain
    const reportClean = ledger.verifyChainIntegrity();
    assert.equal(reportClean.intact, true);
    assert.equal(reportClean.totalEntries, 3);
    assert.equal(reportClean.corruptedSequences.length, 0);
    assert.equal(reportClean.sha256Receipt.length, 64);

    ledger.close();

    // Tamper with sequence 2 payload directly via another SQLite connection
    const directDb = new DatabaseSync(dbPath);
    directDb.exec("UPDATE eos_ledger_entries SET payload_json = '{\"tampered\": true}' WHERE seq = 2");
    directDb.close();

    // Re-verify: must fail-closed and report sequence 2 and 3 as corrupted
    const rawLedger = new EosDurableSqliteLedger(dbPath);
    const reportTampered = rawLedger.verifyChainIntegrity();
    assert.equal(reportTampered.intact, false);
    assert.ok(reportTampered.corruptedSequences.includes(2));

    rawLedger.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-223: Ledger Preconditions and Closed State Protection", () => {
  // Precondition: empty databasePath
  assert.throws(() => new EosDurableSqliteLedger(""), /databasePath must be a non-empty string/);
  assert.throws(() => new EosDurableSqliteLedger("   "), /databasePath must be a non-empty string/);

  const ledger = new EosDurableSqliteLedger(":memory:");

  // Invalid title or projectId
  assert.throws(
    () => ledger.appendEntry({ category: "SECURITY_AUDIT", projectId: "", title: "Valid" }),
    /projectId is required/,
  );
  assert.throws(
    () => ledger.appendEntry({ category: "SECURITY_AUDIT", projectId: "p1", title: "" }),
    /Ledger title is required/,
  );

  // Close ledger and verify all operations fail closed
  ledger.close();
  // Second close is a no-op
  ledger.close();

  assert.throws(
    () => ledger.appendEntry({ category: "SECURITY_AUDIT", projectId: "p", title: "t" }),
    /closed SQLite ledger/,
  );
  assert.throws(() => ledger.searchEntries("query"), /closed SQLite ledger/);
  assert.throws(() => ledger.listRecent(5), /closed SQLite ledger/);
  assert.throws(() => ledger.getEntriesUpTo(5), /closed SQLite ledger/);
  assert.throws(() => ledger.verifyChainIntegrity(), /closed SQLite ledger/);
});

test("BDD-224: Non-FTS Search Fallback and Error Recovery", () => {
  const ledger = new EosDurableSqliteLedger(":memory:");

  ledger.appendEntry({
    category: "ARCHITECTURE_DECISION",
    projectId: "search-fallback",
    title: "Quantum Ledger Architecture",
    payload: { state: "operational" },
  });

  // Drop FTS virtual table to force fallback to standard LIKE queries
  ledger.db.exec("DROP TABLE eos_ledger_fts;");

  // Fallback search should find matching entry via LIKE
  const results = ledger.searchEntries("Quantum");
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Quantum Ledger Architecture");

  // Tokens that sanitize to empty should fall back to listRecent
  const emptyTokenResults = ledger.searchEntries("~~~***???");
  assert.equal(emptyTokenResults.length, 1);

  // If table is completely dropped, inner catch falls back
  ledger.db.exec("DROP TABLE eos_ledger_entries;");
  assert.throws(() => ledger.searchEntries("Anything"), /no such table: eos_ledger_entries/);

  ledger.close();
});
