/**
 * @file eosDistributedCrdtMemory.test.mjs
 * @description Automated test suite for SPEC-348 / CHANGE-210: Distributed Bitemporal CRDT Memory Synchronizer.
 *
 * Verifies BDD-1867 through BDD-1872:
 * - BDD-1867: Hybrid Logical Clock (HLC) causal monotonic ordering & tie-breaking.
 * - BDD-1868: LWW-Register deterministic conflict resolution under network partitions.
 * - BDD-1869: OR-Set add-wins semantics and tombstone tracking.
 * - BDD-1870: PN-Counter commutative increment/decrement convergence.
 * - BDD-1871: Bitemporal "As-Of" historical queries (valid time x tx time).
 * - BDD-1872: Deterministic self-audit harness and receipt emission.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { compareHlc, EosDistributedCrdtMemoryCore } from "../src/core/eosDistributedCrdtMemory.ts";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";

test("BDD-1867: Hybrid Logical Clock generates causally ordered timestamps and breaks ties deterministically", () => {
  const nodeA = new EosDistributedCrdtMemoryCore("node-a", 1000);
  const nodeB = new EosDistributedCrdtMemoryCore("node-b", 1000);

  const tA1 = nodeA.tick(1000);
  const tA2 = nodeA.tick(1000);
  assert.equal(tA2.logicalCounter, tA1.logicalCounter + 1);

  // Update nodeB with tA2
  const tB1 = nodeB.updateHlc(tA2, 1000);
  assert.ok(compareHlc(tB1, tA2) > 0, "Node B clock must causally succeed Node A timestamp");

  // Tie-breaking: identical physical time and counter broken by lexicographical node ID
  const hlcA = { physicalTime: 2000, logicalCounter: 5, nodeId: "alpha", formatted: "" };
  const hlcB = { physicalTime: 2000, logicalCounter: 5, nodeId: "beta", formatted: "" };
  assert.ok(compareHlc(hlcB, hlcA) > 0, "beta must win over alpha in lexicographical tie-break");
});

test("BDD-1868: LWW-Register resolves concurrent partition writes deterministically", () => {
  const node1 = new EosDistributedCrdtMemoryCore("node-1", 1000);
  const node2 = new EosDistributedCrdtMemoryCore("node-2", 1005);

  node1.putLww("app_theme", "dark");
  node2.putLww("app_theme", "cyberpunk");

  // Merge state into node1
  node1.mergeRemoteState(node2.exportState());
  assert.equal(node1.getLww("app_theme"), "cyberpunk", "Node 2 with higher timestamp must win");

  // Commutativity: merging state into node2 yields identical value
  node2.mergeRemoteState(node1.exportState());
  assert.equal(node2.getLww("app_theme"), "cyberpunk", "Merge must be strictly commutative");
});

test("BDD-1869: OR-Set preserves additions across partitions and tracks tombstones accurately", () => {
  const nodeA = new EosDistributedCrdtMemoryCore("node-a", 2000);
  const nodeB = new EosDistributedCrdtMemoryCore("node-b", 2000);

  nodeA.addOrSet("authorized_keys", "key-001", { role: "admin" });
  nodeB.addOrSet("authorized_keys", "key-002", { role: "auditor" });

  // Sync state between A and B
  nodeA.mergeRemoteState(nodeB.exportState());
  nodeB.mergeRemoteState(nodeA.exportState());

  assert.equal(nodeA.getOrSet("authorized_keys").length, 2);
  assert.equal(nodeB.getOrSet("authorized_keys").length, 2);

  // Node A removes key-001
  const removed = nodeA.removeOrSet("authorized_keys", "key-001");
  assert.ok(removed);
  assert.equal(nodeA.getOrSet("authorized_keys").length, 1);

  // Sync removal to Node B
  nodeB.mergeRemoteState(nodeA.exportState());
  assert.equal(nodeB.getOrSet("authorized_keys").length, 1);
  assert.equal(nodeB.getOrSet("authorized_keys")[0].elementId, "key-002");
});

test("BDD-1870: PN-Counter correctly converges across asymmetric increments and decrements", () => {
  const nodeX = new EosDistributedCrdtMemoryCore("node-x");
  const nodeY = new EosDistributedCrdtMemoryCore("node-y");
  const nodeZ = new EosDistributedCrdtMemoryCore("node-z");

  nodeX.incrementCounter("queue_depth", 50);
  nodeY.decrementCounter("queue_depth", 15);
  nodeZ.incrementCounter("queue_depth", 25);

  const stateX = nodeX.exportState();
  const stateY = nodeY.exportState();
  const stateZ = nodeZ.exportState();

  // Cross-merge
  nodeX.mergeRemoteState(stateY);
  nodeX.mergeRemoteState(stateZ);

  nodeY.mergeRemoteState(stateZ);
  nodeY.mergeRemoteState(stateX);

  nodeZ.mergeRemoteState(stateX);
  nodeZ.mergeRemoteState(stateY);

  // 50 - 15 + 25 = 60
  assert.equal(nodeX.getCounter("queue_depth"), 60);
  assert.equal(nodeY.getCounter("queue_depth"), 60);
  assert.equal(nodeZ.getCounter("queue_depth"), 60);
});

test("BDD-1871: Bitemporal 'As-Of' queries retrieve historical slices across valid and tx time", () => {
  const node = new EosDistributedCrdtMemoryCore("temporal-node", 5000);

  node.putLww("contract_rate", 100, { validFrom: 1000, validTo: 3000, txTime: 5000 });
  node.putLww("contract_rate", 150, { validFrom: 3000, validTo: null, txTime: 5010 });

  // Query as of valid time 2000 (past validity)
  const pastRecords = node.queryAsOf("contract_rate", { asOfValidTime: 2000, asOfTxTime: 6000 });
  assert.equal(pastRecords.length, 1);
  assert.equal(pastRecords[0].value, 100);

  // Query as of valid time 4000 (current validity)
  const currentRecords = node.queryAsOf("contract_rate", { asOfValidTime: 4000, asOfTxTime: 6000 });
  assert.equal(currentRecords.length, 1);
  assert.equal(currentRecords[0].value, 150);

  // Query before transaction was recorded
  const uncommittedRecords = node.queryAsOf("contract_rate", { asOfValidTime: 4000, asOfTxTime: 5005 });
  assert.equal(uncommittedRecords.length, 0);
});

test("BDD-1872: Self-auditing harness executes 3-node partition merge and emits receipt", () => {
  const receipt = EosDistributedCrdtMemoryCore.auditDistributedCrdtMemory();
  assert.equal(receipt.status, "VERIFIED");
  assert.equal(receipt.convergenceVerified, true);
  assert.equal(receipt.commutativityVerified, true);
  assert.equal(receipt.bitemporalFidelityVerified, true);
  assert.equal(receipt.specId, "SPEC-348");
  assert.ok(receipt.checksumSha256.length === 64);

  const receiptPath = resolveEvidencePath("CRDT_MEMORY_RECEIPT.json");
  assert.ok(fs.existsSync(receiptPath), "Receipt file must be saved on disk");
});
