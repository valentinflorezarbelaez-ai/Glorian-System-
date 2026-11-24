/**
 * Conflict-Free P2P Mesh Synchronization with Automerge Wasm Test Suite
 *
 * Verifies BDD-1575..BDD-1580 for SPEC-300 / CHANGE-162.
 * Strict Zero Runtime Dependencies (Law V).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { CrdtDocument, DtnOutboxQueue, auditCrdtMeshPipeline } from "../src/core/eosAutomergeCrdtMesh.ts";

test("BDD-1575: Concurrent Mutation and Content-Addressed Causal DAG", () => {
  const docA = new CrdtDocument("doc-dag-test", "actor-a");
  const docB = new CrdtDocument("doc-dag-test", "actor-b");

  const changeA = docA.set("keyA", "valA");
  assert.equal(changeA.actor, "actor-a");
  assert.equal(changeA.seq, 1);
  assert.equal(changeA.lamport, 1);
  assert.equal(changeA.hash.length, 64);
  assert.equal(docA.getHeads().length, 1);
  assert.equal(docA.getHeads()[0], changeA.hash);

  const changeB = docB.set("keyB", "valB");
  assert.equal(changeB.actor, "actor-b");
  assert.equal(changeB.seq, 1);
  assert.equal(changeB.lamport, 1);
  assert.equal(changeB.hash.length, 64);
});

test("BDD-1576: Deterministic Conflict Resolution and State Convergence", () => {
  const docA = new CrdtDocument("doc-converge-test", "actor-alpha");
  const docB = new CrdtDocument("doc-converge-test", "actor-beta");

  // Concurrent conflicting write on the same key
  docA.set("conflictKey", "Alpha Value");
  docB.set("conflictKey", "Beta Value");

  // Sync A -> B
  const syncAtoB = docA.generateSyncMessage(docB.getHeads());
  docB.receiveSyncMessage(syncAtoB);

  // Sync B -> A
  const syncBtoA = docB.generateSyncMessage(docA.getHeads());
  docA.receiveSyncMessage(syncBtoA);

  // Both must have converged to the exact same value
  assert.equal(docA.get("conflictKey"), docB.get("conflictKey"));

  // In our tie-breaker, with equal lamport clock (1), actor-beta > actor-alpha
  assert.equal(docA.get("conflictKey"), "Beta Value");
});

test("BDD-1577: P2P Differential Sync Protocol (Have/Need Exchange)", () => {
  const docA = new CrdtDocument("doc-sync-test", "peer-sender");
  const docB = new CrdtDocument("doc-sync-test", "peer-receiver");

  docA.set("k1", "v1");
  docA.set("k2", "v2");
  docA.set("k3", "v3");

  // Sync message contains 3 changes
  const msg1 = docA.generateSyncMessage(docB.getHeads());
  assert.equal(msg1.changes.length, 3);

  const applied = docB.receiveSyncMessage(msg1);
  assert.equal(applied, 3);
  assert.equal(docB.get("k1"), "v1");
  assert.equal(docB.get("k2"), "v2");
  assert.equal(docB.get("k3"), "v3");

  // Subsequent sync with matching heads contains 0 missing changes
  const msg2 = docA.generateSyncMessage(docB.getHeads());
  assert.equal(msg2.changes.length, 0);
});

test("BDD-1578: Delay-Tolerant Networking (DTN) Offline Queue and Reconnection", () => {
  const docA = new CrdtDocument("doc-dtn-test", "peer-online");
  const docOffline = new CrdtDocument("doc-dtn-test", "peer-offline");

  docA.set("systemConfig", "Optimized V8 Flag Set");

  const dtn = new DtnOutboxQueue();
  assert.equal(dtn.getPendingCount(), 0);

  // Buffer sync message in DTN queue while peer-offline is disconnected
  const syncMsg = docA.generateSyncMessage(docOffline.getHeads());
  const packet = dtn.enqueue("peer-offline", syncMsg);

  assert.equal(dtn.getPendingCount(), 1);
  assert.equal(packet.delivered, false);

  // Flush queue on reconnection
  const delivered = dtn.flush((pkt) => {
    assert.equal(pkt.targetPeer, "peer-offline");
    docOffline.receiveSyncMessage(pkt.syncMessage);
    return true;
  });

  assert.equal(delivered, 1);
  assert.equal(dtn.getPendingCount(), 0);
  assert.equal(docOffline.get("systemConfig"), "Optimized V8 Flag Set");
});

test("BDD-1579: Cryptographic Integrity and Tamper Detection in Operation DAG", () => {
  const doc = new CrdtDocument("doc-tamper-test", "peer-honest");

  // Construct a forged change where hash does not match payload
  const forgedChange = {
    hash: "badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb",
    actor: "peer-malicious",
    seq: 1,
    deps: [],
    lamport: 1,
    timestamp: Date.now(),
    ops: [
      {
        action: "SET",
        key: "adminRole",
        value: "compromised",
        lamport: 1,
        actor: "peer-malicious",
      },
    ],
  };

  assert.throws(
    () => {
      doc.applyRemoteChange(forgedChange);
    },
    (err) => err.message.includes("HASH_MISMATCH_REJECTED"),
  );

  assert.equal(doc.get("adminRole"), undefined);
});

test("BDD-1580: Cryptographic CRDT Mesh Audit Receipt Generation", async () => {
  const receiptPath = resolveEvidencePath("CRDT_MESH_RECEIPT.json");
  const receipt = await auditCrdtMeshPipeline({ writeReceipt: true });

  assert.equal(receipt.specRef, "SPEC-300");
  assert.equal(receipt.totalPeersTested, 3);
  assert.equal(receipt.convergenceVerified, true);
  assert.ok(receipt.changesApplied > 0);
  assert.ok(receipt.dtnPacketsDelivered > 0);
  assert.equal(receipt.sha256Signature.length, 64);

  assert.ok(existsSync(receiptPath));
  const diskReceipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(diskReceipt.sha256Signature, receipt.sha256Signature);
});
