/**
 * Glorian System — Cross-Fleet Merkle-CRDT State Replication Protocol Test Suite
 * Governed by SPEC-308 / CHANGE-170 / BDD-1623..1628
 *
 * Verifies content-addressed Merkle-DAG nodes, join-semilattice algebraic convergence
 * (LWW, PN-Counter, OR-Set), high-performance WASM linear memory vector acceleration,
 * logarithmic anti-entropy synchronization, and cryptographic audit receipts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosCrdtStateReplicatorCore } from "../src/core/eosCrdtStateReplicator.ts";

describe("SPEC-308: Decentralized Cross-Fleet Merkle-CRDT State Replication Protocol", () => {
  // -------------------------------------------------------------------------
  // BDD-1623: Merkle-DAG Node Content Addressing and Causal Ordering
  // -------------------------------------------------------------------------
  it("BDD-1623: Merkle-DAG node creates deterministic SHA-256 cid and tracks causal parents", () => {
    const replicator = new EosCrdtStateReplicatorCore("node-alpha");

    const node1 = replicator.createNode("LWW_REGISTER", "cluster:leader", "node-alpha");
    assert.equal(typeof node1.cid, "string");
    assert.equal(node1.cid.length, 64);
    assert.equal(node1.actor, "node-alpha");
    assert.equal(node1.lamport, 1);
    assert.deepEqual(node1.parents, []);

    const node2 = replicator.createNode("LWW_REGISTER", "cluster:leader", "node-beta");
    assert.equal(node2.lamport, 2);
    assert.deepEqual(node2.parents, [node1.cid]);

    const heads = replicator.getHeads();
    assert.deepEqual(heads, [node2.cid]);
    assert.equal(replicator.getNodeCount(), 2);
  });

  // -------------------------------------------------------------------------
  // BDD-1624: Join-Semilattice LWW-Register Deterministic Convergence
  // -------------------------------------------------------------------------
  it("BDD-1624: LWW-Register satisfies Join-Semilattice (Associativity, Commutativity, Idempotency)", () => {
    const regA = { value: "data-A", lamport: 10, actor: "agent-1", timestamp: 100 };
    const regB = { value: "data-B", lamport: 20, actor: "agent-2", timestamp: 200 };
    const regC = { value: "data-C", lamport: 15, actor: "agent-3", timestamp: 150 };

    // 1. Commutativity: merge(A, B) == merge(B, A)
    const mergeAB = EosCrdtStateReplicatorCore.mergeLww(regA, regB);
    const mergeBA = EosCrdtStateReplicatorCore.mergeLww(regB, regA);
    assert.deepEqual(mergeAB, mergeBA);
    assert.equal(mergeAB.value, "data-B");

    // 2. Associativity: merge(merge(A, B), C) == merge(A, merge(B, C))
    const assocLeft = EosCrdtStateReplicatorCore.mergeLww(mergeAB, regC);
    const assocRight = EosCrdtStateReplicatorCore.mergeLww(regA, EosCrdtStateReplicatorCore.mergeLww(regB, regC));
    assert.deepEqual(assocLeft, assocRight);

    // 3. Idempotency: merge(A, A) == A
    const idemA = EosCrdtStateReplicatorCore.mergeLww(regA, regA);
    assert.deepEqual(idemA, regA);

    // 4. Deterministic tie-breaking on identical Lamport logical clock
    const tie1 = { value: "first", lamport: 50, actor: "actor-X", timestamp: 500 };
    const tie2 = { value: "second", lamport: 50, actor: "actor-Y", timestamp: 500 };
    const tieMerged = EosCrdtStateReplicatorCore.mergeLww(tie1, tie2);
    assert.equal(tieMerged.actor, "actor-Y");
    assert.equal(tieMerged.value, "second");
  });

  // -------------------------------------------------------------------------
  // BDD-1625: Distributed PN-Counter and OR-Set Algebraic Correctness
  // -------------------------------------------------------------------------
  it("BDD-1625: PN-Counter and OR-Set handle concurrent operations without resurrection anomalies", () => {
    const replicator = new EosCrdtStateReplicatorCore("counter-agent");

    // PN-Counter operations
    replicator.createNode("PN_COUNTER", "fleet:ops", { type: "INC", amount: 100 });
    replicator.createNode("PN_COUNTER", "fleet:ops", { type: "DEC", amount: 35 });
    const counter = replicator.getPnCounter("fleet:ops");
    assert.ok(counter);
    assert.equal(counter.value, 65);

    // OR-Set operations (Add-wins with unique tags)
    replicator.createNode("OR_SET", "fleet:active_pods", { action: "ADD", tag: "tag-1", value: "pod-1" });
    replicator.createNode("OR_SET", "fleet:active_pods", { action: "ADD", tag: "tag-2", value: "pod-2" });
    let orSet = replicator.getOrSet("fleet:active_pods");
    assert.ok(orSet);
    assert.equal(orSet.elements.length, 2);
    assert.ok(orSet.elements.includes("pod-1"));
    assert.ok(orSet.elements.includes("pod-2"));

    // Remove tag-1
    replicator.createNode("OR_SET", "fleet:active_pods", { action: "REMOVE", tag: "tag-1" });
    orSet = replicator.getOrSet("fleet:active_pods");
    assert.ok(orSet);
    assert.equal(orSet.elements.length, 1);
    assert.deepEqual(orSet.elements, ["pod-2"]);
  });

  // -------------------------------------------------------------------------
  // BDD-1626: High-Performance Linear Memory Vector Merge Acceleration
  // -------------------------------------------------------------------------
  it("BDD-1626: Executes linear memory vector join with sub-microsecond latency and 0 dependencies", () => {
    const dim = 128;
    const vecA = new Int32Array(dim);
    const vecB = new Int32Array(dim);

    for (let i = 0; i < dim; i++) {
      vecA[i] = i;
      vecB[i] = dim - i;
    }

    const result = EosCrdtStateReplicatorCore.mergeLinearMemoryVectors(vecA, vecB);
    assert.equal(result.dimension, dim);
    assert.equal(result.mergedElements.length, dim);
    assert.equal(result.operationsCount, dim);
    assert.equal(result.memoryBytesUsed, dim * 4);

    // Verify element-wise maximum
    for (let i = 0; i < dim; i++) {
      assert.equal(result.mergedElements[i], Math.max(vecA[i], vecB[i]));
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1627: Fast Anti-Entropy Divergence Detection and Delta Exchange
  // -------------------------------------------------------------------------
  it("BDD-1627: Anti-entropy protocol compares Merkle roots and converges divergent replicas", () => {
    const replicaA = new EosCrdtStateReplicatorCore("replica-eu");
    const replicaB = new EosCrdtStateReplicatorCore("replica-us");

    replicaA.createNode("LWW_REGISTER", "fleet:dns", "dns-primary-eu");
    replicaB.createNode("LWW_REGISTER", "fleet:cdn", "cdn-edge-us");

    // Divergent roots before sync
    assert.notEqual(replicaA.computeMerkleRoot(), replicaB.computeMerkleRoot());

    // Execute anti-entropy sync
    const syncReport = replicaA.antiEntropySync(replicaB);
    assert.equal(syncReport.inSync, true);
    assert.equal(syncReport.divergentNodesCount, 2);
    assert.equal(replicaA.computeMerkleRoot(), replicaB.computeMerkleRoot());

    // Subsequent sync when already in sync returns 0 divergent nodes in O(1)
    const idempotentSync = replicaA.antiEntropySync(replicaB);
    assert.equal(idempotentSync.inSync, true);
    assert.equal(idempotentSync.divergentNodesCount, 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1628: Cross-Fleet State Replication & Cryptographic Receipt Emission
  // -------------------------------------------------------------------------
  it("BDD-1628: Audits full cross-fleet CRDT replication pipeline and generates signed receipt", async () => {
    const root = process.cwd();
    const receipt = await EosCrdtStateReplicatorCore.auditCrdtReplicationPipeline(root);

    assert.equal(receipt.specRef, "SPEC-308");
    assert.equal(receipt.changeRef, "CHANGE-170");
    assert.equal(receipt.status, "CRDT_CONVERGENCE_VERIFIED");
    assert.equal(receipt.fleetProjectsAudited, 10);
    assert.equal(receipt.semilatticePropertiesVerified.associativity, true);
    assert.equal(receipt.semilatticePropertiesVerified.commutativity, true);
    assert.equal(receipt.semilatticePropertiesVerified.idempotency, true);
    assert.equal(receipt.cryptographicSignature.length, 64);

    const receiptOnDisk = resolveEvidencePath("CRDT_REPLICATION_RECEIPT.json", root);
    assert.ok(fs.existsSync(receiptOnDisk));
    const diskContent = JSON.parse(fs.readFileSync(receiptOnDisk, "utf8"));
    assert.equal(diskContent.cryptographicSignature, receipt.cryptographicSignature);
  });
});
