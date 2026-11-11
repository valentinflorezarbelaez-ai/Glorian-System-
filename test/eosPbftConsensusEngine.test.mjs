/**
 * Test Suite: EosPbftConsensusEngine (SPEC-210 / BDD-1069..BDD-1073)
 * Practical Byzantine Fault Tolerant Consensus Engine & Replicated State Machine
 *
 * Verifies:
 * - BDD-1069: Cluster initialization, Byzantine quorum sizing (N >= 3f + 1, quorum = 2f + 1), and primary election.
 * - BDD-1070: Three-phase consensus progression with honest supermajority (PRE-PREPARE, PREPARE, COMMIT).
 * - BDD-1071: Fault tolerance under single crash/mute Byzantine node without cluster stalling.
 * - BDD-1072: Byzantine equivocation detection and automatic validator slashing receipt generation.
 * - BDD-1073: Distributed view-change protocol, NEW-VIEW assembly, and primary failover continuity.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  EosPbftCluster,
  EosPbftNode,
  computeMessageDigest,
  computeFsmHash,
} from "../src/core/eosPbftConsensusEngine.ts";

describe("EosPbftConsensusEngine (SPEC-210 / BDD-1069..BDD-1073)", () => {
  it("BDD-1069: Cluster initialization, quorum sizing, and deterministic primary election", () => {
    assert.ok(EosPbftNode);
    assert.ok(computeMessageDigest("genesis").length === 64);
    assert.ok(computeFsmHash({ key: "val" }).length === 64);

    const nodeIds = ["node-0", "node-1", "node-2", "node-3"];
    const cluster = new EosPbftCluster(nodeIds);

    assert.equal(cluster.totalNodes, 4);
    assert.equal(cluster.f, 1); // floor((4-1)/3) = 1
    assert.equal(cluster.quorumSize, 3); // 2f + 1 = 3
    assert.equal(cluster.getPrimaryNodeId(0), "node-0");
    assert.equal(cluster.getPrimaryNodeId(1), "node-1");

    const status = cluster.getClusterStatus();
    assert.equal(status.activeQuorum, true);
    assert.equal(status.quarantinedNodes.length, 0);
    assert.equal(status.primaryNodeId, "node-0");
    assert.equal(status.currentView, 0);
    assert.equal(status.nodes.length, 4);

    // Verify node 0 is primary and node 1 is backup
    const node0 = cluster.getNode("node-0");
    const node1 = cluster.getNode("node-1");
    assert.equal(node0.isPrimaryForView(0, nodeIds), true);
    assert.equal(node1.isPrimaryForView(0, nodeIds), false);
  });

  it("BDD-1070: Three-phase consensus progression with honest majority", () => {
    const nodeIds = ["node-0", "node-1", "node-2", "node-3"];
    const cluster = new EosPbftCluster(nodeIds);

    const proposal = { type: "SET", key: "auth_token", value: "pbft_sovereign_verified" };
    const receipt = cluster.propose(proposal);

    assert.equal(receipt.view, 0);
    assert.equal(receipt.sequenceNumber, 1);
    assert.ok(receipt.sha256Receipt.length === 64);
    assert.ok(receipt.fsmStateHash.length === 64);

    // Check certificate
    assert.equal(receipt.committedCertificate.view, 0);
    assert.equal(receipt.committedCertificate.sequenceNumber, 1);
    assert.ok(receipt.committedCertificate.commits.length >= 3);

    // Verify all honest nodes applied the mutation to their replicated state machine
    for (const id of nodeIds) {
      const node = cluster.getNode(id);
      assert.equal(node.lastCommittedSeq, 1);
      assert.equal(node.fsmState.auth_token, "pbft_sovereign_verified");
    }

    // Propose a second sequential mutation
    const proposal2 = { type: "SET", key: "tier", value: "TIER_0" };
    const receipt2 = cluster.propose(proposal2);
    assert.equal(receipt2.sequenceNumber, 2);

    for (const id of nodeIds) {
      const node = cluster.getNode(id);
      assert.equal(node.lastCommittedSeq, 2);
      assert.equal(node.fsmState.auth_token, "pbft_sovereign_verified");
      assert.equal(node.fsmState.tier, "TIER_0");
    }
  });

  it("BDD-1071: Fault tolerance under single crash/mute Byzantine node", () => {
    const nodeIds = ["node-0", "node-1", "node-2", "node-3"];
    const cluster = new EosPbftCluster(nodeIds);

    // Quarantine node-3 simulating a silent, crashed, or partitioned Byzantine node
    const node3 = cluster.getNode("node-3");
    node3.quarantine();
    assert.equal(node3.isQuarantined, true);

    const status = cluster.getClusterStatus();
    assert.equal(status.quarantinedNodes.length, 1);
    assert.equal(status.quarantinedNodes[0], "node-3");
    assert.equal(status.activeQuorum, true); // 3 nodes remaining >= quorum 3

    // Proposal must still commit cleanly across honest majority (Node-0, Node-1, Node-2)
    const proposal = { type: "SET", key: "fault_resilience", value: "BYZANTINE_TOLERATED" };
    const receipt = cluster.propose(proposal);

    assert.ok(receipt);
    assert.equal(receipt.sequenceNumber, 1);

    // Node-0, Node-1, Node-2 committed
    assert.equal(cluster.getNode("node-0").fsmState.fault_resilience, "BYZANTINE_TOLERATED");
    assert.equal(cluster.getNode("node-1").fsmState.fault_resilience, "BYZANTINE_TOLERATED");
    assert.equal(cluster.getNode("node-2").fsmState.fault_resilience, "BYZANTINE_TOLERATED");

    // Quarantined Node-3 did not receive or apply the mutation
    assert.equal(node3.fsmState.fault_resilience, undefined);
  });

  it("BDD-1072: Equivocation detection and Byzantine slashing", () => {
    const nodeIds = ["node-0", "node-1", "node-2", "node-3"];
    const cluster = new EosPbftCluster(nodeIds);

    // Simulate primary Node-0 attempting Byzantine equivocation (sending dual conflicting pre-prepares)
    const proposalHonest = { type: "SET", key: "balance", value: 1000 };
    const proposalForged = { type: "SET", key: "balance", value: 999999 };

    const slashingReceipt = cluster.simulateEquivocation("node-0", proposalHonest, proposalForged);

    assert.ok(slashingReceipt);
    assert.equal(slashingReceipt.slashedNodeId, "node-0");
    assert.equal(slashingReceipt.evidenceType, "EQUIVOCATION_DETECTED");
    assert.notEqual(slashingReceipt.digestA, slashingReceipt.digestB);
    assert.ok(slashingReceipt.sha256Receipt.length === 64);

    // Malicious node must be automatically quarantined
    const node0 = cluster.getNode("node-0");
    assert.equal(node0.isQuarantined, true);

    // Slashing ledger records the receipt
    const ledger = cluster.getSlashingReceipts();
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].slashedNodeId, "node-0");
  });

  it("BDD-1073: Distributed view-change protocol, NEW-VIEW assembly, and primary failover", () => {
    const nodeIds = ["node-0", "node-1", "node-2", "node-3"];
    const cluster = new EosPbftCluster(nodeIds);

    // Execute an initial valid proposal in View 0
    cluster.propose({ type: "SET", key: "genesis", value: "view_0_established" });

    // Node-0 fails/equivocates and is quarantined
    cluster.getNode("node-0").quarantine();

    // Trigger distributed view-change to View 1
    const viewChangeResult = cluster.triggerViewChange();

    assert.equal(viewChangeResult.newView, 1);
    assert.equal(viewChangeResult.newPrimary, "node-1"); // (1 % 4) = 1
    assert.equal(viewChangeResult.newViewMsg.type, "NEW-VIEW");
    assert.equal(viewChangeResult.newViewMsg.sender, "node-1");

    // Verify all active nodes updated their view to View 1
    assert.equal(cluster.getNode("node-1").currentView, 1);
    assert.equal(cluster.getNode("node-2").currentView, 1);
    assert.equal(cluster.getNode("node-3").currentView, 1);

    // New primary Node-1 proposes subsequent mutation in View 1
    const nextProposal = { type: "SET", key: "view_1_status", value: "HEALTHY" };
    const receiptView1 = cluster.propose(nextProposal);

    assert.equal(receiptView1.view, 1);
    assert.equal(receiptView1.sequenceNumber, 2);

    assert.equal(cluster.getNode("node-1").fsmState.genesis, "view_0_established");
    assert.equal(cluster.getNode("node-1").fsmState.view_1_status, "HEALTHY");
    assert.equal(cluster.getNode("node-2").fsmState.view_1_status, "HEALTHY");
  });

  it("BDD-1073-CLI: End-to-end CLI execution and JSON state output", () => {
    const outputJson = execFileSync("node", ["bin/eos.mjs", "pbft:cluster", "--nodes=v0,v1,v2,v3", "--json"], {
      encoding: "utf8",
    });
    const parsed = JSON.parse(outputJson);

    assert.equal(parsed.status.totalNodes, 4);
    assert.equal(parsed.status.f, 1);
    assert.equal(parsed.status.quorumSize, 3);
    assert.equal(parsed.status.activeQuorum, true);
    assert.ok(parsed.executionReceipt.sha256Receipt.length === 64);
  });
});
