/**
 * Test Suite: EosDistributedPeerMesh (Layer 0 — Decentralized Peer Mesh & Gossip Engine)
 * SPEC-188: Decentralized Distributed Peer Mesh Engine
 * CHANGE-073: Distributed Peer Mesh Engine
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosDistributedPeerMesh } from "../src/core/eosDistributedPeerMesh.ts";

describe("SPEC-188: EosDistributedPeerMesh", () => {
  it("BDD-957: initializes local node and registers remote peers", () => {
    const mesh = new EosDistributedPeerMesh({
      localNodeId: "node-alpha",
      address: "10.0.0.1",
      port: 8001,
      metadata: { region: "us-east-1" },
    });

    assert.equal(mesh.localNodeId, "node-alpha");
    assert.equal(mesh.address, "10.0.0.1");
    assert.equal(mesh.port, 8001);

    // Local node is registered as ALIVE
    const local = mesh.getPeer("node-alpha");
    assert.ok(local);
    assert.equal(local.status, "ALIVE");
    assert.equal(local.metadata.region, "us-east-1");
    assert.equal(mesh.getActivePeerCount(), 1);

    // Register a remote peer
    const peerBeta = mesh.registerPeer({
      nodeId: "node-beta",
      address: "10.0.0.2",
      port: 8002,
      status: "ALIVE",
      incarnation: 0,
      metadata: { region: "eu-west-1" },
    });

    assert.equal(peerBeta.nodeId, "node-beta");
    assert.equal(mesh.getActivePeerCount(), 2);
    assert.equal(mesh.listPeers().length, 2);
  });

  it("BDD-958: failure detector transitions ALIVE to SUSPECT and DEAD on elapsed timeouts", () => {
    const mesh = new EosDistributedPeerMesh({
      localNodeId: "node-1",
      suspectTimeoutMs: 100,
      deadTimeoutMs: 200,
    });

    const t0 = 1000;
    mesh.registerPeer({
      nodeId: "node-2",
      address: "127.0.0.1",
      port: 8002,
      status: "ALIVE",
      incarnation: 0,
      metadata: {},
      lastSeenTimestamp: t0,
    });

    // At t0 + 50ms: still ALIVE
    let result = mesh.evaluateFailureDetector(t0 + 50);
    assert.equal(result.transitionedToSuspect.length, 0);
    assert.equal(mesh.getPeer("node-2")?.status, "ALIVE");

    // At t0 + 150ms: transitions to SUSPECT
    result = mesh.evaluateFailureDetector(t0 + 150);
    assert.deepEqual(result.transitionedToSuspect, ["node-2"]);
    assert.equal(mesh.getPeer("node-2")?.status, "SUSPECT");

    // At t0 + 250ms: still SUSPECT (dead threshold is 100 + 200 = 300ms)
    result = mesh.evaluateFailureDetector(t0 + 250);
    assert.equal(result.transitionedToDead.length, 0);
    assert.equal(mesh.getPeer("node-2")?.status, "SUSPECT");

    // At t0 + 350ms: transitions to DEAD
    result = mesh.evaluateFailureDetector(t0 + 350);
    assert.deepEqual(result.transitionedToDead, ["node-2"]);
    assert.equal(mesh.getPeer("node-2")?.status, "DEAD");
  });

  it("BDD-959: higher incarnation overrides SUSPECT state; heartbeat revives peer", () => {
    const mesh = new EosDistributedPeerMesh({
      localNodeId: "node-1",
    });

    mesh.registerPeer({
      nodeId: "node-2",
      address: "127.0.0.1",
      port: 8002,
      status: "SUSPECT",
      incarnation: 1,
      metadata: {},
    });

    assert.equal(mesh.getPeer("node-2")?.status, "SUSPECT");

    // Update with higher incarnation revives node
    mesh.registerPeer({
      nodeId: "node-2",
      address: "127.0.0.1",
      port: 8002,
      status: "ALIVE",
      incarnation: 2,
      metadata: {},
    });

    assert.equal(mesh.getPeer("node-2")?.status, "ALIVE");
    assert.equal(mesh.getPeer("node-2")?.incarnation, 2);

    // Heartbeat also clears SUSPECT
    mesh.getPeer("node-2").status = "SUSPECT";
    mesh.recordHeartbeat("node-2");
    assert.equal(mesh.getPeer("node-2")?.status, "ALIVE");
  });

  it("BDD-960: vector clock causality and deterministic conflict resolution", () => {
    const clockA = { "node-1": 2, "node-2": 1 };
    const clockB = { "node-1": 1, "node-2": 1 };
    const clockC = { "node-1": 2, "node-2": 2 };
    const clockD = { "node-1": 1, "node-2": 3 };

    // Dominates
    assert.equal(EosDistributedPeerMesh.compareVectorClocks(clockA, clockB), "DOMINATES");
    assert.equal(EosDistributedPeerMesh.compareVectorClocks(clockC, clockA), "DOMINATES");
    // Preceded
    assert.equal(EosDistributedPeerMesh.compareVectorClocks(clockB, clockA), "PRECEDED");
    // Equal
    assert.equal(EosDistributedPeerMesh.compareVectorClocks(clockA, { ...clockA }), "EQUAL");
    // Concurrent
    assert.equal(EosDistributedPeerMesh.compareVectorClocks(clockA, clockD), "CONCURRENT");

    // Merge
    const merged = EosDistributedPeerMesh.mergeVectorClocks(clockA, clockD);
    assert.deepEqual(merged, { "node-1": 2, "node-2": 3 });

    // Test mesh distributed state
    const mesh = new EosDistributedPeerMesh({ localNodeId: "node-1" });
    const entry = mesh.setState("cluster.config.workers", 16);
    assert.equal(entry.key, "cluster.config.workers");
    assert.equal(entry.value, 16);
    assert.equal(mesh.getState("cluster.config.workers"), 16);

    // Merge remote dominating state
    const remoteUpdate = {
      key: "cluster.config.workers",
      value: 32,
      clock: { "node-1": 1, "node-2": 5 },
      updatedAt: Date.now() + 100,
      updatedBy: "node-2",
    };

    const mergeRes = mesh.mergeStateEntries([remoteUpdate]);
    assert.deepEqual(mergeRes.appliedKeys, ["cluster.config.workers"]);
    assert.equal(mesh.getState("cluster.config.workers"), 32);
  });

  it("BDD-961: gossip sync packet generation and epidemic infection processing", () => {
    const nodeA = new EosDistributedPeerMesh({
      localNodeId: "mesh-alpha",
      gossipFanout: 2,
    });

    const nodeB = new EosDistributedPeerMesh({
      localNodeId: "mesh-beta",
      gossipFanout: 2,
    });

    // Populate nodeA with peers and state
    nodeA.registerPeer({
      nodeId: "mesh-gamma",
      address: "10.0.0.3",
      port: 8003,
      status: "ALIVE",
      incarnation: 0,
    });
    nodeA.setState("service.status", "DEPLOYED");

    // Create gossip packet from nodeA
    const packet = nodeA.createGossipPacket();
    assert.equal(packet.senderId, "mesh-alpha");
    assert.ok(packet.membershipDeltas.some((m) => m.nodeId === "mesh-gamma"));
    assert.ok(packet.stateDeltas.some((s) => s.key === "service.status"));

    // Process packet at nodeB
    const processResult = nodeB.processGossipPacket(packet);
    assert.ok(processResult.appliedMembershipUpdates >= 1);
    assert.equal(processResult.appliedStateUpdates, 1);

    // Verify nodeB acquired state and membership
    assert.equal(nodeB.getState("service.status"), "DEPLOYED");
    assert.ok(nodeB.getPeer("mesh-gamma"));
    assert.equal(nodeB.getPeer("mesh-gamma")?.status, "ALIVE");

    // Check fanout selection
    const targets = nodeA.selectGossipTargets(1);
    assert.equal(targets.length, 1);
  });

  it("BDD-962: metrics snapshot and invariant preservation", () => {
    const mesh = new EosDistributedPeerMesh({ localNodeId: "node-x" });
    mesh.registerPeer({
      nodeId: "node-y",
      address: "127.0.0.1",
      port: 8002,
      status: "ALIVE",
      incarnation: 0,
    });
    mesh.registerPeer({
      nodeId: "node-z",
      address: "127.0.0.1",
      port: 8003,
      status: "SUSPECT",
      incarnation: 0,
    });
    mesh.setState("key1", "val1");
    mesh.createGossipPacket();

    const metrics = mesh.getMeshMetrics();
    assert.equal(metrics.totalPeers, 3); // node-x, node-y, node-z
    assert.equal(metrics.alivePeers, 2); // node-x, node-y
    assert.equal(metrics.suspectPeers, 1); // node-z
    assert.equal(metrics.deadPeers, 0);
    assert.equal(metrics.stateKeysCount, 1);
    assert.equal(metrics.gossipRoundsRun, 1);
    assert.equal(metrics.incarnation, 0);

    // Test suspicion refutation increments incarnation
    const newIncarnation = mesh.refuteSuspicion();
    assert.equal(newIncarnation, 1);
    assert.equal(mesh.getMeshMetrics().incarnation, 1);
  });
});
