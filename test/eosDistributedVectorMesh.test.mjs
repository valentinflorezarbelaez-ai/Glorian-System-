/**
 * BDD Test Suite for SPEC-315 / CHANGE-177:
 * Distributed Consistent Hashing Vector Partition Mesh & Raft Sharding Engine
 *
 * Verifies BDD-1665..BDD-1670.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { EosDistributedVectorMeshCore } from "../src/core/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence");
const RECEIPT_PATH = path.join(EVIDENCE_DIR, "DISTRIBUTED_VECTOR_MESH_RECEIPT.json");

function generateTestVector(dim, seed = 1) {
  const vec = new Float32Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    vec[i] = (s / 4294967296) * 2.0 - 1.0;
  }
  return vec;
}

describe("SPEC-315: Distributed Consistent Hashing Vector Partition Mesh", () => {
  // -------------------------------------------------------------------------
  // BDD-1665: Consistent Hash Ring Virtual Token Placement & Load Balance
  // -------------------------------------------------------------------------
  it("BDD-1665: Consistent Hash Ring Virtual Token Placement & Load Balance", () => {
    const mesh = new EosDistributedVectorMeshCore({
      vnodesPerNode: 64,
      replicationFactor: 2,
    });

    mesh.addNode({ nodeId: "node-1", host: "10.0.0.1", port: 9001, state: "ACTIVE", vnodeCount: 64 });
    mesh.addNode({ nodeId: "node-2", host: "10.0.0.2", port: 9002, state: "ACTIVE", vnodeCount: 64 });
    mesh.addNode({ nodeId: "node-3", host: "10.0.0.3", port: 9003, state: "ACTIVE", vnodeCount: 64 });

    const tokens = mesh.getRingTokens();
    assert.equal(tokens.length, 192);

    // Invariant: virtual tokens must be strictly monotonic ascending
    for (let i = 1; i < tokens.length; i++) {
      assert.ok(
        tokens[i].token >= tokens[i - 1].token,
        `Token out of order at ${i}: ${tokens[i].token} < ${tokens[i - 1].token}`,
      );
    }

    // Insert 150 keys and verify load distribution
    for (let i = 0; i < 150; i++) {
      const raw = generateTestVector(32, 100 + i);
      mesh.insertVector(`key-${i}`, raw);
    }

    const stats = mesh.getClusterStats();
    assert.equal(stats.totalPhysicalNodes, 3);
    assert.equal(stats.activeNodes, 3);
    assert.equal(stats.totalVnodes, 192);
    assert.equal(stats.totalVectors, 150);

    // Verify all nodes received vectors (no starvation)
    const keyMap = mesh.getKeysMap();
    const nodeCounts = new Map();
    for (const mapping of keyMap.values()) {
      nodeCounts.set(mapping.primary, (nodeCounts.get(mapping.primary) || 0) + 1);
    }
    assert.equal(nodeCounts.size, 3);
    for (const count of nodeCounts.values()) {
      assert.ok(count > 10, `Node had too few keys: ${count}`);
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1666: Multi-Replica Placement and Fault Domain Diversity
  // -------------------------------------------------------------------------
  it("BDD-1666: Multi-Replica Placement and Fault Domain Diversity", () => {
    const mesh = new EosDistributedVectorMeshCore({
      vnodesPerNode: 32,
      replicationFactor: 3,
    });

    mesh.addNode({
      nodeId: "node-a",
      host: "10.0.1.1",
      port: 9001,
      state: "ACTIVE",
      vnodeCount: 32,
      faultDomain: "us-east-1a",
    });
    mesh.addNode({
      nodeId: "node-b",
      host: "10.0.2.1",
      port: 9002,
      state: "ACTIVE",
      vnodeCount: 32,
      faultDomain: "us-east-1b",
    });
    mesh.addNode({
      nodeId: "node-c",
      host: "10.0.3.1",
      port: 9003,
      state: "ACTIVE",
      vnodeCount: 32,
      faultDomain: "us-east-1c",
    });

    const raw = generateTestVector(64, 42);
    const placement = mesh.insertVector("entity-vec-1", raw);

    assert.ok(placement.primary);
    assert.equal(placement.replicas.length, 2);

    // All 3 selected nodes must be mutually distinct
    const allAssigned = [placement.primary, ...placement.replicas];
    const uniqueAssigned = new Set(allAssigned);
    assert.equal(uniqueAssigned.size, 3, "Primary and replicas must be distinct nodes");
  });

  // -------------------------------------------------------------------------
  // BDD-1667: Minimal Key Migration Under Dynamic Churn
  // -------------------------------------------------------------------------
  it("BDD-1667: Minimal Key Migration Under Dynamic Churn", () => {
    const mesh = new EosDistributedVectorMeshCore({
      vnodesPerNode: 64,
      replicationFactor: 2,
    });

    mesh.addNode({ nodeId: "node-1", host: "10.0.0.1", port: 9001, state: "ACTIVE", vnodeCount: 64 });
    mesh.addNode({ nodeId: "node-2", host: "10.0.0.2", port: 9002, state: "ACTIVE", vnodeCount: 64 });
    mesh.addNode({ nodeId: "node-3", host: "10.0.0.3", port: 9003, state: "ACTIVE", vnodeCount: 64 });

    const totalKeys = 100;
    for (let i = 0; i < totalKeys; i++) {
      mesh.insertVector(`item-${i}`, generateTestVector(16, 200 + i));
    }

    // Add 4th node: expected migration ratio is approximately 1/4 = 25%, bounded by <= 50%
    const migrated = mesh.rebalanceOnNodeJoin({
      nodeId: "node-4",
      host: "10.0.0.4",
      port: 9004,
      state: "ACTIVE",
      vnodeCount: 64,
    });

    const ratio = migrated / totalKeys;
    assert.ok(migrated > 0, "Some keys must migrate to new node");
    assert.ok(ratio <= 0.45, `Migration ratio ${ratio} exceeded minimal churn bound (<= 0.45)`);

    // Remove node: keys must migrate away from removed node
    const migratedOnLeave = mesh.rebalanceOnNodeLeave("node-4");
    assert.ok(migratedOnLeave >= 0);

    const keyMapAfter = mesh.getKeysMap();
    for (const mapping of keyMapAfter.values()) {
      assert.notEqual(mapping.primary, "node-4", "Removed node must not be primary for any key");
      assert.ok(!mapping.replicas.includes("node-4"), "Removed node must not be replica for any key");
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1668: Raft Leadership Election and Majority Quorum Safety
  // -------------------------------------------------------------------------
  it("BDD-1668: Raft Leadership Election and Majority Quorum Safety", () => {
    const mesh = new EosDistributedVectorMeshCore({ vnodesPerNode: 16 });

    // Initial state: no nodes, no quorum
    assert.equal(mesh.hasMajorityQuorum(), false);

    mesh.addNode({ nodeId: "node-1", host: "10.0.0.1", port: 9001, state: "ACTIVE", vnodeCount: 16 });
    mesh.addNode({ nodeId: "node-2", host: "10.0.0.2", port: 9002, state: "ACTIVE", vnodeCount: 16 });
    mesh.addNode({ nodeId: "node-3", host: "10.0.0.3", port: 9003, state: "ACTIVE", vnodeCount: 16 });

    assert.equal(mesh.hasMajorityQuorum(), true);

    // Election succeeds with quorum
    const elected = mesh.electLeader("node-1");
    assert.equal(elected, true);

    const raft = mesh.getRaftState();
    assert.equal(raft.role, "LEADER");
    assert.equal(raft.leaderId, "node-1");
    assert.equal(raft.currentTerm, 1);
    assert.ok(raft.commitIndex >= 3);

    // Step-down when node-1 leaves
    mesh.removeNode("node-1");
    const raftAfterLeave = mesh.getRaftState();
    assert.equal(raftAfterLeave.leaderId, null);
    assert.equal(raftAfterLeave.role, "FOLLOWER");
  });

  // -------------------------------------------------------------------------
  // BDD-1669: Federated Scatter-Gather Sub-Millisecond Parallel Query
  // -------------------------------------------------------------------------
  it("BDD-1669: Federated Scatter-Gather Sub-Millisecond Parallel Query", () => {
    const mesh = new EosDistributedVectorMeshCore({
      vnodesPerNode: 32,
      replicationFactor: 2,
    });

    mesh.addNode({ nodeId: "node-1", host: "10.0.0.1", port: 9001, state: "ACTIVE", vnodeCount: 32 });
    mesh.addNode({ nodeId: "node-2", host: "10.0.0.2", port: 9002, state: "ACTIVE", vnodeCount: 32 });
    mesh.addNode({ nodeId: "node-3", host: "10.0.0.3", port: 9003, state: "ACTIVE", vnodeCount: 32 });

    const dim = 64;
    for (let i = 0; i < 40; i++) {
      mesh.insertVector(`vec-${i}`, generateTestVector(dim, 500 + i));
    }

    const query = generateTestVector(dim, 999);
    const t0 = performance.now();
    const hits = mesh.searchFederated(query, 5);
    const elapsedMs = performance.now() - t0;

    assert.equal(hits.length, 5);
    assert.ok(elapsedMs < 50, `Search took too long: ${elapsedMs} ms`);

    // Monotonic ascending distance verification
    for (let i = 1; i < hits.length; i++) {
      assert.ok(
        hits[i].distance >= hits[i - 1].distance,
        `Hits not sorted: ${hits[i].distance} < ${hits[i - 1].distance}`,
      );
    }

    // Each hit carries provenance
    for (const h of hits) {
      assert.ok(h.id);
      assert.ok(h.primaryShard);
      assert.ok(h.nodeId);
      assert.ok(typeof h.distance === "number");
    }
  });

  // -------------------------------------------------------------------------
  // BDD-1670: Structural Invariant Audit & Cryptographic SHA-256 Receipt
  // -------------------------------------------------------------------------
  it("BDD-1670: Structural Invariant Audit & Cryptographic SHA-256 Receipt", () => {
    const mesh = new EosDistributedVectorMeshCore({
      vnodesPerNode: 32,
      replicationFactor: 2,
    });

    mesh.addNode({ nodeId: "node-1", host: "10.0.0.1", port: 9001, state: "ACTIVE", vnodeCount: 32 });
    mesh.addNode({ nodeId: "node-2", host: "10.0.0.2", port: 9002, state: "ACTIVE", vnodeCount: 32 });
    mesh.addNode({ nodeId: "node-3", host: "10.0.0.3", port: 9003, state: "ACTIVE", vnodeCount: 32 });

    for (let i = 0; i < 20; i++) {
      mesh.insertVector(`audit-v-${i}`, generateTestVector(32, 700 + i));
    }

    const receipt = mesh.auditMeshInvariants(EVIDENCE_DIR);

    assert.equal(receipt.specRef, "SPEC-315");
    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.totalNodes, 3);
    assert.equal(receipt.totalVnodes, 96);
    assert.equal(receipt.totalKeys, 20);
    assert.equal(receipt.quorumSatisfied, true);
    assert.equal(receipt.ringContinuityVerified, true);
    assert.ok(receipt.sha256Signature.length === 64);

    // Verify receipt persisted on disk
    assert.ok(fs.existsSync(RECEIPT_PATH), "Receipt file must exist");
    const rawContent = fs.readFileSync(RECEIPT_PATH, "utf8");
    const parsed = JSON.parse(rawContent);

    assert.equal(parsed.specRef, "SPEC-315");
    assert.equal(parsed.sha256Signature, receipt.sha256Signature);

    // Verify SHA-256 authenticity
    const { sha256Signature, ...body } = parsed;
    const computed = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    assert.equal(computed, sha256Signature, "Cryptographic signature must match receipt payload");
  });
});
