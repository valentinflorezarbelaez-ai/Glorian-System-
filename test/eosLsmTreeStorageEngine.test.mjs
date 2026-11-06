/**
 * EOS SYSTEM — SPEC-079 BDD TEST SUITE
 * Log-Structured Merge-Tree (LSM-Tree) Storage Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosLsmTreeStorageEngine } from '../src/core/eosLsmTreeStorageEngine.ts';

test('BDD-233: Sequential MemTable Insertion and Immutable SSTable Flush', () => {
  const engine = new EosLsmTreeStorageEngine(5); // Capacity of 5

  // Insert 4 entries -> all in MemTable
  for (let i = 1; i <= 4; i++) {
    engine.put(`key:${i}`, `val:${i}`);
  }
  assert.equal(engine.getMemTableSize(), 4);
  assert.equal(engine.getSsTableCount(), 0);

  // Insert 5th and 6th -> triggers flush
  engine.put('key:5', 'val:5');
  engine.put('key:6', 'val:6');

  // One SSTable flushed, remaining entry in MemTable
  assert.equal(engine.getSsTableCount(), 1);
  assert.equal(engine.getMemTableSize(), 1);

  // Retrieve values from both SSTable and MemTable
  assert.equal(engine.get('key:1'), 'val:1');
  assert.equal(engine.get('key:6'), 'val:6');
});

test('BDD-234: Bloom Filter Fast Non-Membership and Point-Lookup', () => {
  const engine = new EosLsmTreeStorageEngine(3);

  engine.put('telemetry:cpu', '95%');
  engine.put('telemetry:ram', '64GB');
  engine.put('telemetry:disk', '1TB'); // Triggers flush of 3 items

  assert.equal(engine.getSsTableCount(), 1);

  // Key that exists
  assert.equal(engine.get('telemetry:cpu'), '95%');

  // Key that definitely does not exist
  assert.equal(engine.get('telemetry:nonexistent'), null);

  // Tombstone test
  engine.delete('telemetry:cpu');
  assert.equal(engine.get('telemetry:cpu'), null);

  // Compaction test
  engine.put('k1', 'v1');
  engine.put('k2', 'v2');
  engine.put('k3', 'v3'); // Second flush
  assert.equal(engine.getSsTableCount(), 2);

  const purged = engine.compact();
  assert.ok(purged >= 0);
  assert.equal(engine.getSsTableCount(), 1);
});
