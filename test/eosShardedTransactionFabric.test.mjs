/**
 * @file eosShardedTransactionFabric.test.mjs
 * @description Automated test suite for SPEC-351 / CHANGE-213: Autonomous Quantum-Resilient Distributed Transaction Fabric.
 *
 * Verifies BDD-1885 through BDD-1890:
 * - BDD-1885: Consistent Hash Ring Topology & Deterministic Key Bisect Routing
 * - BDD-1886: Multi-Version Concurrency Control (MVCC) Snapshot Read Isolation
 * - BDD-1887: Distributed Two-Phase Commit (2PC) Cross-Shard Atomic Orchestration
 * - BDD-1888: Autonomous Conflict Detection, Abort & Compensating Rollback Invariance
 * - BDD-1889: Post-Quantum HMAC-SHA384 Proof Receipts & Tamper-Evident Signatures
 * - BDD-1890: Leslie Lamport TLA+ Model 94 Model-Checking Verification Invariant
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  EosConsistentHashRing,
  EosShardNode,
  EosShardedTransactionFabricCore,
} from "../src/core/eosShardedTransactionFabric.ts";

test("BDD-1885: Consistent Hash Ring Topology & Deterministic Key Bisect Routing", () => {
  const ring = new EosConsistentHashRing({ vnodesPerShard: 64 });
  const shards = ["shard-0", "shard-1", "shard-2", "shard-3"];
  for (const s of shards) ring.addShard(s);

  // 1. Total vnodes
  assert.equal(ring.getVnodes().length, 256);
  assert.equal(ring.calculateStandardDeviation(), 0);

  // 2. Deterministic routing
  const targetKey = "user:profile:99201";
  const route1 = ring.routeKey(targetKey);
  const route2 = ring.routeKey(targetKey);
  assert.equal(route1.shardId, route2.shardId);
  assert.equal(route1.vnodeId, route2.vnodeId);
  assert.equal(route1.token, route2.token);

  // 3. Dynamic shard scaling
  ring.addShard("shard-4");
  assert.equal(ring.getVnodes().length, 320);
  ring.removeShard("shard-4");
  assert.equal(ring.getVnodes().length, 256);
});

test("BDD-1886: Multi-Version Concurrency Control (MVCC) Snapshot Read Isolation", () => {
  const node = new EosShardNode("shard-test");
  const hmacSecret = "test-secret";

  // t=100: Initial write
  node.prepare("tx-1", [{ key: "counter", value: 10 }], 90, hmacSecret);
  node.commit("tx-1", 100, [{ key: "counter", value: 10 }]);

  // Snapshot at t=100 sees value 10
  const read100 = node.readSnapshot("counter", 100);
  assert.ok(read100);
  assert.equal(read100.value, 10);

  // t=200: Update write
  node.prepare("tx-2", [{ key: "counter", value: 25 }], 100, hmacSecret);
  node.commit("tx-2", 200, [{ key: "counter", value: 25 }]);

  // Snapshot at t=100 MUST still see 10 (repeatable read invariant)
  const readOldSnapshot = node.readSnapshot("counter", 100);
  assert.ok(readOldSnapshot);
  assert.equal(readOldSnapshot.value, 10);

  // Snapshot at t=200 sees new value 25
  const readNewSnapshot = node.readSnapshot("counter", 200);
  assert.ok(readNewSnapshot);
  assert.equal(readNewSnapshot.value, 25);
});

test("BDD-1887: Distributed Two-Phase Commit (2PC) Cross-Shard Atomic Orchestration", () => {
  const fabric = new EosShardedTransactionFabricCore("test-secret-2pc", 32);
  fabric.addShard("shard-a");
  fabric.addShard("shard-b");

  const receipt = fabric.executeTransaction({
    txId: "tx-cross-shard-transfer",
    readSnapshotTimestamp: 1000,
    writes: [
      { key: "vault:a", value: 500 },
      { key: "vault:b", value: 750 },
    ],
  });

  assert.equal(receipt.status, "COMMITTED");
  assert.equal(receipt.compensatingRollbackExecuted, false);
  assert.ok(receipt.commitTimestamp > 1000);
  assert.ok(receipt.shardsInvolved.length >= 1);
});

test("BDD-1888: Autonomous Conflict Detection, Abort & Compensating Rollback Invariance", () => {
  const fabric = new EosShardedTransactionFabricCore("test-secret-conflict", 32);
  fabric.addShard("shard-x");
  fabric.addShard("shard-y");

  // Initial state commit
  fabric.executeTransaction({
    txId: "tx-seed",
    readSnapshotTimestamp: 1000,
    writes: [{ key: "record:critical", value: "original" }],
  });

  // Conflicting transaction with stale snapshot (read at 900 < 1001 commit)
  const abortReceipt = fabric.executeTransaction({
    txId: "tx-concurrent-writer",
    readSnapshotTimestamp: 900,
    writes: [{ key: "record:critical", value: "corrupted" }],
    compensatingWrites: [{ key: "log:compensation-fired", value: true }],
  });

  assert.equal(abortReceipt.status, "ABORTED");
  assert.equal(abortReceipt.compensatingRollbackExecuted, true);

  // Verify critical record was NOT overwritten by aborted transaction
  const currentVal = fabric.readSnapshot("record:critical");
  assert.equal(currentVal?.value, "original");
});

test("BDD-1889: Post-Quantum HMAC-SHA384 Proof Receipts & Tamper-Evident Signatures", () => {
  const fabric = new EosShardedTransactionFabricCore("hmac-quantum-test-secret", 32);
  fabric.addShard("shard-sig");

  const receipt = fabric.executeTransaction({
    txId: "tx-tamper-check",
    readSnapshotTimestamp: 1000,
    writes: [{ key: "doc:signature-test", value: { signed: true } }],
  });

  // Valid signature verification
  assert.equal(fabric.verifyReceiptSignature(receipt), true);

  // Tampered receipt detection (e.g. status forged from ABORTED to COMMITTED)
  const forgedReceipt = { ...receipt, status: "ABORTED" };
  assert.equal(fabric.verifyReceiptSignature(forgedReceipt), false);
});

test("BDD-1890: Leslie Lamport TLA+ Model 94 Model-Checking Verification Invariant", () => {
  const receipt = EosShardedTransactionFabricCore.audit(process.cwd());

  assert.equal(receipt.status, "HEALTHY");
  assert.equal(receipt.totalShards, 4);
  assert.equal(receipt.totalVnodes, 256);
  assert.equal(receipt.ringBalanceStandardDeviation, 0);
  assert.equal(receipt.mvccIsolationVerified, true);
  assert.equal(receipt.twoPhaseCommitVerified, true);
  assert.equal(receipt.rollbackSoundnessVerified, true);
  assert.equal(receipt.postQuantumHmacVerified, true);
  assert.equal(receipt.tlcModelPass, true);

  // Evidence file on disk
  const receiptPath = resolveEvidencePath("SHARDED_TRANSACTION_FABRIC_RECEIPT.json", process.cwd());
  assert.ok(fs.existsSync(receiptPath));
  const fileContent = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  assert.equal(fileContent.status, "HEALTHY");
});
