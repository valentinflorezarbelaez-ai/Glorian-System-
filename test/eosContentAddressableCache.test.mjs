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
      { NODE_ENV: "test" }
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
      originalDurationMs: 450
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
