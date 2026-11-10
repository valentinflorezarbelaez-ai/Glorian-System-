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

import { EosDurableSqliteLedger, sanitizeFts5Query } from "../src/core/eosDurableSqliteLedger.ts";

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
  assert.throws(() => new EosDurableSqliteLedger(""), /databasePath must be a non-empty string or ':memory:'/);
  assert.throws(() => new EosDurableSqliteLedger("   "), /databasePath must be a non-empty string or ':memory:'/);

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
  ledger.appendEntry({
    category: "SECURITY_AUDIT",
    projectId: "search-fallback",
    title: "Unrelated Rotation Record",
    payload: {},
  });

  // Drop FTS virtual table to force fallback to standard LIKE queries
  ledger.db.exec("DROP TABLE eos_ledger_fts;");

  // Fallback search should find only the matching entry via LIKE
  const results = ledger.searchEntries("Quantum");
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Quantum Ledger Architecture");

  // Multi-token fallback ANDs the clauses (both tokens must match)
  const bothTokens = ledger.searchEntries("Quantum Architecture");
  assert.equal(bothTokens.length, 1);
  const splitTokens = ledger.searchEntries("Quantum Rotation");
  assert.equal(splitTokens.length, 0);

  // Fallback search with punctuation delimiters
  const punctResults = ledger.searchEntries("Quantum - Architecture:");
  assert.equal(punctResults.length, 1);
  assert.equal(punctResults[0].title, "Quantum Ledger Architecture");

  // Tokens that sanitize to empty should fall back to listRecent
  const emptyTokenResults = ledger.searchEntries("~~~***???");
  assert.equal(emptyTokenResults.length, 2);

  // If table is completely dropped, inner catch falls back
  ledger.db.exec("DROP TABLE eos_ledger_entries;");
  assert.throws(() => ledger.searchEntries("Anything"), /no such table: eos_ledger_entries/);

  ledger.close();
});

test("BDD-225: limit clamping is fail-safe at both boundaries", () => {
  const ledger = new EosDurableSqliteLedger(":memory:");
  for (let i = 1; i <= 3; i++) {
    ledger.appendEntry({
      category: "VERIFICATION_RECEIPT",
      projectId: "clamp",
      title: `Receipt ${i}`,
      payload: { i },
    });
  }
  assert.equal(ledger.listRecent(0).length, 1);
  assert.equal(ledger.listRecent(-5).length, 1);
  assert.equal(ledger.listRecent(2.9).length, 2);
  assert.equal(ledger.listRecent(1000, "clamp").length, 3);
  assert.equal(ledger.searchEntries("Receipt", 0).length, 1);
  assert.equal(ledger.searchEntries("", 0).length, 1);
  ledger.close();
});

test("BDD-226: FTS5 sanitization defends syntax, cap, and non-strings", () => {
  assert.equal(sanitizeFts5Query(null), "");
  assert.equal(sanitizeFts5Query(42), "");
  assert.equal(sanitizeFts5Query("~~~ !!!"), "");
  assert.equal(sanitizeFts5Query('drop "table"; --'), '"drop" "table"');
  assert.equal(sanitizeFts5Query("keep-hyphen under_score"), '"keep-hyphen" "under_score"');
  const seventeen = Array.from({ length: 17 }, (_, i) => `tok${i}`).join(" ");
  const capped = sanitizeFts5Query(seventeen);
  assert.equal(capped.split(" ").length, 16);
  assert.ok(capped.endsWith('"tok15"'));
  assert.equal(sanitizeFts5Query("   "), "");
});

test("BDD-227: empty chain verifies with genesis head hash", () => {
  const ledger = new EosDurableSqliteLedger(":memory:");
  const report = ledger.verifyChainIntegrity();
  assert.equal(report.intact, true);
  assert.equal(report.totalEntries, 0);
  assert.equal(report.databasePath, ":memory:");
  assert.equal(report.journalMode, "memory");
  assert.equal(report.headHash, "0".repeat(64));
  assert.equal(report.corruptedSequences.length, 0);
  assert.equal(report.sha256Receipt.length, 64);
  ledger.close();
});

test("BDD-228: entries survive close/reopen and the chain continues", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ledger-reopen-"));
  const dbPath = path.join(tmpDir, "durable.sqlite");
  try {
    const first = new EosDurableSqliteLedger(dbPath);
    const a = first.appendEntry({
      category: "MISSION_DIRECTION",
      projectId: "durability",
      title: "Entry A",
      payload: { nested: { ok: true }, list: [1, 2, 3] },
      engramTopicKey: "  topic/a  ",
    });
    const b = first.appendEntry({
      category: "SECURITY_AUDIT",
      projectId: "durability",
      title: "Entry B",
      payload: {},
    });
    assert.equal(a.engramTopicKey, "topic/a");
    assert.equal(b.engramTopicKey, null);
    assert.ok(b.entryId.startsWith("EOS-LEDGER-000002-"));
    assert.equal(first.db.prepare("PRAGMA busy_timeout;").get().timeout, 10000);
    assert.equal(first.db.prepare("PRAGMA foreign_keys;").get().foreign_keys, 1);
    assert.equal(first.db.prepare("PRAGMA synchronous;").get().synchronous, 1);
    first.close();

    const reopened = new EosDurableSqliteLedger(dbPath);
    const recent = reopened.listRecent(10);
    assert.equal(recent.length, 2);
    assert.deepEqual(recent[1].payload, { nested: { ok: true }, list: [1, 2, 3] });
    const integrity = reopened.verifyChainIntegrity();
    assert.equal(integrity.intact, true);
    assert.equal(integrity.totalEntries, 2);
    assert.equal(integrity.journalMode, "wal");
    assert.equal(integrity.headHash, b.entryHash);

    const c = reopened.appendEntry({
      category: "ARCHITECTURE_DECISION",
      projectId: "durability",
      title: "Entry C",
      payload: {},
    });
    assert.equal(c.prevHash, b.entryHash);
    assert.equal(c.seq, 3);
    assert.ok(c.entryId.startsWith("EOS-LEDGER-000003-"));
    assert.equal(reopened.verifyChainIntegrity().intact, true);
    reopened.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-229: default ledger path is canonical under .eos/state", () => {
  const p = EosDurableSqliteLedger.defaultLedgerPath(process.cwd());
  assert.ok(p.endsWith(path.join(".eos", "state", "eos_sovereign_ledger.sqlite")));
  assert.ok(path.isAbsolute(p));
});

test("BDD-230: mutation hardening — defaults, boundaries, rollback, and filters", () => {
  // Default constructor argument must remain ":memory:".
  const implicit = new EosDurableSqliteLedger();
  assert.equal(implicit.verifyChainIntegrity().databasePath, ":memory:");
  implicit.close();

  const ledger = new EosDurableSqliteLedger(":memory:");
  const base = { category: "SECURITY_AUDIT", payload: {} };

  // Single-character title/projectId are valid (trim length > 0, not > 1).
  const minimal = ledger.appendEntry({ ...base, projectId: "p", title: "x" });
  assert.equal(minimal.title, "x");
  assert.equal(minimal.projectId, "p");
  assert.equal(minimal.entryId.length, 28);

  // Whitespace-only entryId falls back to auto; single-char explicit id is kept.
  const blankId = ledger.appendEntry({ ...base, projectId: "p", title: "blank", entryId: "   " });
  assert.ok(blankId.entryId.startsWith("EOS-LEDGER-"));
  const shortId = ledger.appendEntry({ ...base, projectId: "p", title: "short", entryId: "A" });
  assert.equal(shortId.entryId, "A");

  // Duplicate entryId rolls back cleanly; the ledger stays usable afterwards.
  assert.throws(() => ledger.appendEntry({ ...base, projectId: "p", title: "dup", entryId: "A" }));
  const afterRollback = ledger.appendEntry({ ...base, projectId: "p", title: "after" });
  assert.equal(afterRollback.seq, 4);

  // Single-entry head hash is the entry hash, not genesis.
  const single = new EosDurableSqliteLedger(":memory:");
  const only = single.appendEntry({ ...base, projectId: "p", title: "only" });
  assert.equal(single.verifyChainIntegrity().headHash, only.entryHash);
  single.close();

  // projectId filter: whitespace is ignored, single-char ids still filter.
  ledger.appendEntry({ ...base, projectId: "other", title: "elsewhere" });
  assert.equal(ledger.listRecent(100, "   ").length, 5);
  assert.equal(ledger.listRecent(100, "p").length, 4);

  // Empty payload_json (tampered row) maps to {} instead of crashing.
  ledger.db.exec("UPDATE eos_ledger_entries SET payload_json = '' WHERE seq = 1");
  assert.deepEqual(ledger.listRecent(100).find((r) => r.seq === 1).payload, {});
  ledger.close();

  // Quote removal must split adjacent tokens, not fuse them.
  assert.equal(sanitizeFts5Query('abc"def'), '"abc" "def"');

  // Default limit is 10; the hard ceiling is 100.
  const bulk = new EosDurableSqliteLedger(":memory:");
  for (let i = 0; i < 102; i++) {
    bulk.appendEntry({ ...base, projectId: "bulk", title: `Bulk ${i}` });
  }
  assert.equal(bulk.listRecent().length, 10);
  assert.equal(bulk.searchEntries("Bulk").length, 10);
  assert.equal(bulk.listRecent(1000).length, 100);
  assert.equal(bulk.searchEntries("Bulk", 1000).length, 100);
  bulk.close();
});

test("BDD-231: invalid paths fall back to a true in-memory ledger", () => {
  // A NUL byte makes DatabaseSync throw; the constructor must fall back to
  // ":memory:" (not an empty-string temp-file database) and stay usable.
  const fallback = new EosDurableSqliteLedger("bad\0path");
  const report = fallback.verifyChainIntegrity();
  assert.equal(report.databasePath, ":memory:");
  assert.equal(report.journalMode, "memory");
  const entry = fallback.appendEntry({
    category: "VERIFICATION_RECEIPT",
    projectId: "fallback",
    title: "Still durable in memory",
    payload: {},
  });
  assert.equal(entry.seq, 1);
  fallback.close();

  // A corrupt database file fails schema init; the ledger must still fall
  // back to a true in-memory database rather than an empty-string temp file.
  const tmpCorrupt = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ledger-corrupt-"));
  try {
    const corruptPath = path.join(tmpCorrupt, "corrupt.sqlite");
    fs.writeFileSync(corruptPath, "this is not a sqlite database");
    const recovered = new EosDurableSqliteLedger(corruptPath);
    const recoveredReport = recovered.verifyChainIntegrity();
    assert.equal(recoveredReport.databasePath, ":memory:");
    assert.equal(recoveredReport.journalMode, "memory");
    recovered.close();
  } finally {
    try {
      fs.rmSync(tmpCorrupt, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }

  // A single-character databasePath is valid (trim length > 0, not > 1).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ledger-onechar-"));
  const previousCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    const oneChar = new EosDurableSqliteLedger("x");
    assert.ok(oneChar.verifyChainIntegrity().databasePath.endsWith("x"));
    oneChar.close();
  } finally {
    process.chdir(previousCwd);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});
