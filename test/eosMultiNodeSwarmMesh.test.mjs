/**
 * @file eosMultiNodeSwarmMesh.test.mjs
 * @description Automated test suite for SPEC-365 / CHANGE-227: Decentralized Multi-Node Swarm Clustering & P2P Mesh Gossip.
 *
 * Verifies BDD-1969 through BDD-1974:
 * - BDD-1969: Discrete Node Initialization & Cryptographic Identity
 * - BDD-1970: Dynamic Peer Discovery & Handshake Verification
 * - BDD-1971: Epidemic Anti-Entropy Gossip State Synchronization
 * - BDD-1972: Merkle-DAG Distributed Transaction Replication
 * - BDD-1973: Distributed Cross-Node Task Work-Stealing
 * - BDD-1974: Full Diagnostic Audit & Mesh Cluster Receipt
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { EosMultiNodeSwarmMesh } from "../src/core/eosMultiNodeSwarmMesh.ts";

test("BDD-1969: Discrete Node Initialization & Cryptographic Identity", () => {
  const mesh = new EosMultiNodeSwarmMesh({ localNodeId: "alpha-seed" });

  assert.equal(typeof mesh.getLocalNodeId(), "string");
  assert.equal(mesh.getLocalNodeId().length, 16);
  assert.equal(mesh.getState(), "ONLINE");
  assert.equal(mesh.getPeers().length, 0);
  assert.equal(mesh.getTaskQueueDepth(), 0);
  assert.equal(mesh.getLedger().length, 0);
  assert.equal(mesh.getMerkleRoot(), "0".repeat(64));
});

test("BDD-1970: Dynamic Peer Discovery & Handshake Verification", () => {
  const nodeA = new EosMultiNodeSwarmMesh({ localNodeId: "node-a" });
  const nodeB = new EosMultiNodeSwarmMesh({ localNodeId: "node-b" });

  const handshake = nodeA.handlePeerHandshake(nodeB.getLocalNodeId(), "127.0.0.1", 9001);

  assert.equal(handshake.success, true);
  assert.equal(handshake.localNodeId, nodeA.getLocalNodeId());
  assert.ok(handshake.latencyMs < 50, `Handshake latency ${handshake.latencyMs}ms must be < 50ms`);

  const peersA = nodeA.getPeers();
  assert.equal(peersA.length, 1);
  assert.equal(peersA[0].nodeId, nodeB.getLocalNodeId());
  assert.equal(peersA[0].state, "ONLINE");
});

test("BDD-1971: Epidemic Anti-Entropy Gossip State Synchronization", () => {
  const nodes = [
    new EosMultiNodeSwarmMesh({ localNodeId: "node-1" }),
    new EosMultiNodeSwarmMesh({ localNodeId: "node-2" }),
    new EosMultiNodeSwarmMesh({ localNodeId: "node-3" }),
    new EosMultiNodeSwarmMesh({ localNodeId: "node-4" }),
    new EosMultiNodeSwarmMesh({ localNodeId: "node-5" }),
  ];

  // Interconnect in ring topology
  for (let i = 0; i < nodes.length; i++) {
    const next = (i + 1) % nodes.length;
    nodes[i].handlePeerHandshake(nodes[next].getLocalNodeId());
  }

  // Node 0 creates state delta
  const digest0 = nodes[0].createGossipDigest();
  assert.ok(digest0.digestHash.length === 64);
  assert.equal(digest0.round, 1);

  // Propagate gossip across ring
  for (let i = 1; i < nodes.length; i++) {
    const res = nodes[i].receiveGossipDigest(digest0);
    assert.equal(res.converged, true);
  }

  // Evict suspect node with artificial past timestamp
  const evicted = nodes[0].evictSuspectNodes(Date.now() + 10000);
  assert.equal(evicted.length, 1);
  assert.equal(evicted[0], nodes[1].getLocalNodeId());
});

test("BDD-1972: Merkle-DAG Distributed Transaction Replication", () => {
  const nodeA = new EosMultiNodeSwarmMesh({ localNodeId: "mesh-tx-a" });
  const nodeB = new EosMultiNodeSwarmMesh({ localNodeId: "mesh-tx-b" });

  nodeA.handlePeerHandshake(nodeB.getLocalNodeId());
  nodeB.handlePeerHandshake(nodeA.getLocalNodeId());

  const tx1 = nodeA.appendTransaction({ type: "PROOF_OF_CEGIS", proofId: "PRF-001" });
  assert.ok(tx1.txId.startsWith("TX-"));
  assert.equal(tx1.txHash.length, 64);
  assert.equal(tx1.signature.length, 64);

  const replicated = nodeB.ingestReplicatedTx(tx1);
  assert.equal(replicated, true);

  // Re-ingest duplicate must return false
  assert.equal(nodeB.ingestReplicatedTx(tx1), false);

  // Merkle roots must match
  const rootA = nodeA.getMerkleRoot();
  const rootB = nodeB.getMerkleRoot();
  assert.equal(rootA, rootB);
  assert.equal(rootA.length, 64);
});

test("BDD-1973: Distributed Cross-Node Task Work-Stealing", () => {
  const donor = new EosMultiNodeSwarmMesh({ localNodeId: "donor-saturated" });
  const thief = new EosMultiNodeSwarmMesh({ localNodeId: "thief-idle" });

  // Saturated donor has 10 tasks
  for (let i = 0; i < 10; i++) {
    donor.queueTask({ taskId: `task-${i}`, payload: { weight: 100 } });
  }
  assert.equal(donor.getTaskQueueDepth(), 10);
  assert.equal(thief.getTaskQueueDepth(), 0);

  // Thief executes work steal
  const contract = thief.executeWorkSteal(donor);
  assert.ok(contract !== null);
  assert.equal(contract.tasksTransferred, 5);
  assert.equal(contract.thiefNodeId, thief.getLocalNodeId());
  assert.equal(contract.donorNodeId, donor.getLocalNodeId());
  assert.equal(contract.contractDigest.length, 64);

  // Queues are now balanced
  assert.equal(donor.getTaskQueueDepth(), 5);
  assert.equal(thief.getTaskQueueDepth(), 5);

  // Attempting to steal when balanced yields null
  const balancedSteal = thief.executeWorkSteal(donor);
  assert.equal(balancedSteal, null);
});

test("BDD-1974: Full Diagnostic Audit & Mesh Cluster Receipt", async () => {
  const receipt = await EosMultiNodeSwarmMesh.audit();

  assert.equal(receipt.specId, "SPEC-365");
  assert.equal(receipt.changeId, "CHANGE-227");
  assert.equal(receipt.clusterSize, 3);
  assert.ok(receipt.convergenceLatencyMs < 100);
  assert.equal(receipt.checks.layerZeroP2PTransport, "PASS");
  assert.equal(receipt.checks.peerDiscoveryHandshake, "PASS");
  assert.equal(receipt.checks.epidemicAntiEntropyGossip, "PASS");
  assert.equal(receipt.checks.merkleDagLedgerReplication, "PASS");
  assert.equal(receipt.checks.byzantineFaultTolerance, "PASS");
  assert.equal(receipt.checks.crossNodeTaskWorkStealing, "PASS");
  assert.equal(receipt.checks.zeroDependencyPurity, "PASS");
  assert.equal(receipt.integrityHash.length, 64);
});
