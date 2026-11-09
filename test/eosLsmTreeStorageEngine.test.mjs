/**
 * EOS SYSTEM — SPEC-079 BDD TEST SUITE
 * Log-Structured Merge-Tree (LSM-Tree) Storage Engine
 */

import test from "node:test";
import assert from "node:assert/strict";
import { EosLsmTreeStorageEngine } from "../src/core/eosLsmTreeStorageEngine.ts";

test("BDD-233: Sequential MemTable Insertion and Immutable SSTable Flush", () => {
  const engine = new EosLsmTreeStorageEngine(5); // Capacity of 5

  // Insert 4 entries -> all in MemTable
  for (let i = 1; i <= 4; i++) {
    engine.put(`key:${i}`, `val:${i}`);
  }
  assert.equal(engine.getMemTableSize(), 4);
  assert.equal(engine.getSsTableCount(), 0);

  // Insert 5th and 6th -> triggers flush
  engine.put("key:5", "val:5");
  engine.put("key:6", "val:6");

  // One SSTable flushed, remaining entry in MemTable
  assert.equal(engine.getSsTableCount(), 1);
  assert.equal(engine.getMemTableSize(), 1);

  // Retrieve values from both SSTable and MemTable
  assert.equal(engine.get("key:1"), "val:1");
  assert.equal(engine.get("key:6"), "val:6");
});

test("BDD-234: Bloom Filter Fast Non-Membership and Point-Lookup", () => {
  const engine = new EosLsmTreeStorageEngine(3);

  engine.put("telemetry:cpu", "95%");
  engine.put("telemetry:ram", "64GB");
  engine.put("telemetry:disk", "1TB"); // Triggers flush of 3 items

  assert.equal(engine.getSsTableCount(), 1);

  // Key that exists
  assert.equal(engine.get("telemetry:cpu"), "95%");

  // Key that definitely does not exist
  assert.equal(engine.get("telemetry:nonexistent"), null);

  // Tombstone test
  engine.delete("telemetry:cpu");
  assert.equal(engine.get("telemetry:cpu"), null);

  // Compaction test
  engine.put("k1", "v1");
  engine.put("k2", "v2");
  engine.put("k3", "v3"); // Second flush
  assert.equal(engine.getSsTableCount(), 2);

  const purged = engine.compact();
  assert.ok(purged >= 0);
  assert.equal(engine.getSsTableCount(), 1);
});

test("BDD-235: LSM Preconditions, Ledger Logging, Deletion Flushes, and Empty Compaction", () => {
  // Capacity <= 0 throws
  assert.throws(() => new EosLsmTreeStorageEngine(0), /MemTable capacity must be positive/);

  // Default constructor
  const defaultEngine = new EosLsmTreeStorageEngine();
  assert.equal(defaultEngine.flushMemTable(), null); // Flush empty memTable returns null
  assert.equal(defaultEngine.compact(), 0); // Compaction with 0 sstables returns 0

  // Empty key preconditions
  assert.throws(() => defaultEngine.put("", "val"), /Key cannot be empty/);
  assert.throws(() => defaultEngine.delete(""), /Key cannot be empty/);
  assert.throws(() => defaultEngine.get(""), /Key cannot be empty/);

  // Key range check in SSTable get() (key < minKey or key > maxKey)
  defaultEngine.put("m-middle", "val-m");
  defaultEngine.flushMemTable();
  assert.equal(defaultEngine.get("a-before"), null); // key < table.minKey
  assert.equal(defaultEngine.get("z-after"), null); // key > table.maxKey

  // Deletion triggering flush
  const delEngine = new EosLsmTreeStorageEngine(2);
  delEngine.delete("del:1");
  delEngine.delete("del:2"); // Triggers flushMemTable from delete()
  assert.equal(delEngine.getSsTableCount(), 1);

  // Compaction resulting in 0 alive entries (all tombstones)
  const tombEngine = new EosLsmTreeStorageEngine(2);
  tombEngine.put("item1", "v1");
  tombEngine.put("item2", "v2"); // Flushed to SSTable 1
  tombEngine.delete("item1");
  tombEngine.delete("item2"); // Flushed to SSTable 2
  assert.equal(tombEngine.getSsTableCount(), 2);
  const eliminated = tombEngine.compact();
  assert.equal(eliminated, 0);
  assert.equal(tombEngine.getSsTableCount(), 0);

  // Ledger integration in flushMemTable (success & error catch)
  const mockLedgerSuccess = {
    appendEntry: (entry) => {
      assert.equal(entry.category, "VERIFICATION_RECEIPT");
      assert.ok(entry.title.includes("LSM SSTable Flushed"));
      return { entryHash: "ledger_receipt" };
    },
  };
  const ledgerEngine = new EosLsmTreeStorageEngine(2, mockLedgerSuccess);
  ledgerEngine.put("x", "1");
  ledgerEngine.put("y", "2"); // Triggers flush with ledger
  assert.equal(ledgerEngine.getSsTableCount(), 1);

  const mockLedgerError = {
    appendEntry: () => {
      throw new Error("Disk full");
    },
  };
  const ledgerErrEngine = new EosLsmTreeStorageEngine(2, mockLedgerError);
  assert.doesNotThrow(() => {
    ledgerErrEngine.put("x", "1");
    ledgerErrEngine.put("y", "2");
  });
});
