/**
 * EOS SYSTEM — SPEC-062 BDD TEST SUITE
 * Content-Addressable Storage (CAS) & Action Cache Engine
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EosContentAddressableCache } from "../src/core/eosContentAddressableCache.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

test("BDD-190: Deterministic CAS Blob Storage and Deduplication", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-cas-test-"));

  try {
    const cas = new EosContentAddressableCache(tmpDir);
    const contentA = "export const VERSION = '66.0.0';\n";
    const contentB = "export const VERSION = '66.0.0';\n"; // duplicate

    const digestA = cas.putBlob(contentA);
    const digestB = cas.putBlob(contentB);

    assert.equal(digestA, digestB);
    assert.equal(digestA.length, 64);

    const retrieved = cas.getBlob(digestA);
    assert.ok(retrieved);
    assert.equal(retrieved.toString("utf8"), contentA);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-191: Action Cache Hit and Redundant Execution Avoidance", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ac-test-"));
  const ledgerPath = path.join(tmpDir, "ledger.sqlite");

  try {
    const cas = new EosContentAddressableCache(tmpDir);
    const actionKey = cas.computeActionKey(
      ["a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"],
      "node --test test/sample.test.mjs",
      { NODE_ENV: "test" },
    );

    assert.equal(actionKey.length, 64);

    // Initial query: cache miss
    const miss = cas.getAction(actionKey);
    assert.equal(miss, null);

    // Put action result
    const stored = cas.putAction(actionKey, {
      exitCode: 0,
      stdout: "✔ All tests pass (0 regressions)\n",
      stderr: "",
      originalDurationMs: 450,
    });

    assert.equal(stored.exitCode, 0);

    // Second query: cache hit in O(1)
    const hit = cas.getAction(actionKey);
    assert.ok(hit);
    assert.equal(hit.exitCode, 0);
    assert.equal(hit.originalDurationMs, 450);

    // Check stats and Ledger persistence
    const stats = cas.getStats();
    assert.equal(stats.cacheHits, 1);
    assert.equal(stats.cacheMisses, 1);
    assert.equal(stats.estimatedSavedMs, 450);

    const saved = cas.recordReceiptInLedger(ledgerPath);
    assert.equal(saved, true);

    const ledger = new EosDurableSqliteLedger(ledgerPath);
    const recent = ledger.listRecent(5);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].category, "VERIFICATION_RECEIPT");
    ledger.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-192: CAS Buffer Input, Missing Blobs and Precondition Validations", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-cas-buffer-test-"));

  try {
    const cas = new EosContentAddressableCache(tmpDir);

    // Initial stats before any queries
    const emptyStats = cas.getStats();
    assert.equal(emptyStats.hitRatio, 0);

    // Put blob as Buffer
    const buf = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    const digest = cas.putBlob(buf);
    assert.equal(digest.length, 64);

    // Retrieve existing blob
    const retrieved = cas.getBlob(digest);
    assert.ok(retrieved);
    assert.deepEqual(retrieved, buf);

    // Non-existent blob -> returns null
    const missingDigest = "f".repeat(64);
    assert.equal(cas.getBlob(missingDigest), null);

    // Preconditions for getBlob and putBlob
    assert.throws(() => cas.getBlob("short-digest"), /valid 64-char digest required/);
    assert.throws(() => cas.computeActionKey("not-array", "cmd"), /sourceAstHashes must be an array/);
    assert.throws(() => cas.computeActionKey([], ""), /command is required/);
    assert.throws(() => cas.putAction("short", { exitCode: 0, originalDurationMs: 10 }), /valid actionKey required/);
    assert.throws(() => cas.getAction("short"), /valid actionKey required/);

    // computeActionKey with default envContext
    const keyWithoutEnv = cas.computeActionKey(["hash1"], "test-cmd");
    assert.equal(keyWithoutEnv.length, 64);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-193: Corrupted Action JSON Handling & Ledger Branches", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-cas-corrupt-test-"));

  try {
    const cas = new EosContentAddressableCache(tmpDir);
    const validKey = "e".repeat(64);

    // Write malformed JSON directly into action directory
    const actionPath = path.join(tmpDir, ".eos", "cas", "actions", validKey);
    fs.writeFileSync(actionPath, "{ malformed json", "utf8");

    // getAction should catch JSON.parse error and return null, counting as miss
    const result = cas.getAction(validKey);
    assert.equal(result, null);
    const stats = cas.getStats();
    assert.equal(stats.cacheMisses, 1);

    // Test recordReceiptInLedger with directory path
    const savedInDir = cas.recordReceiptInLedger(tmpDir);
    assert.equal(savedInDir, true);

    // Test recordReceiptInLedger with .db path
    const dbPath = path.join(tmpDir, "custom.db");
    const savedInDb = cas.recordReceiptInLedger(dbPath);
    assert.equal(savedInDb, true);

    // Test recordReceiptInLedger default ledger path (calls defaultLedgerPath())
    const savedDefault = cas.recordReceiptInLedger();
    assert.equal(typeof savedDefault, "boolean");

    // Test catch block when appendEntry fails
    const originalAppend = EosDurableSqliteLedger.prototype.appendEntry;
    try {
      EosDurableSqliteLedger.prototype.appendEntry = () => {
        throw new Error("Disk full simulation");
      };
      const failed = cas.recordReceiptInLedger(tmpDir);
      assert.equal(failed, false);
    } finally {
      EosDurableSqliteLedger.prototype.appendEntry = originalAppend;
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});
