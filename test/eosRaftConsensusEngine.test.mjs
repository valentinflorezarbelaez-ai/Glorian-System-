/**
 * EOS SYSTEM — LAYER-0 DISTRIBUTED RAFT CONSENSUS ENGINE TEST SUITE
 * Governed by SPEC-206, CHANGE-091, ADR-091, BDD-1049..BDD-1053 (v76.0.0)
 *
 * Validates:
 * - BDD-1049: Leader election through majority quorum voting.
 * - BDD-1050: Log entry append, linearizable replication, and commit to state machine.
 * - BDD-1051: Stale follower log conflict detection, truncation, and alignment.
 * - BDD-1052: Network partition resilience, split-brain prevention, and partition healing.
 * - BDD-1053: Log snapshot compaction, Merkle receipts, and CLI execution.
 *
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosRaftCluster, EosRaftNode } from "../src/core/eosRaftConsensusEngine.ts";

describe("EosRaftConsensusEngine (SPEC-206 / BDD-1049..BDD-1053)", () => {
  it("BDD-1049: Leader election through majority quorum", () => {
    const cluster = new EosRaftCluster("test-raft-1049", ["node-1", "node-2", "node-3"]);
    assert.equal(cluster.nodeCount, 3);
    assert.equal(cluster.quorumSize, 2);
    assert.equal(cluster.leaderId, null);

    // Election with all nodes reachable
    const election = cluster.startElection("node-1");
    assert.equal(election.success, true);
    assert.equal(election.term, 1);
    assert.equal(election.votesReceived, 3);
    assert.equal(cluster.leaderId, "node-1");

    const leader = cluster.getNode("node-1");
    const follower = cluster.getNode("node-2");
    assert.equal(leader?.role, "LEADER");
    assert.equal(follower?.role, "FOLLOWER");
    assert.equal(follower?.currentTerm, 1);
    assert.equal(follower?.votedFor, "node-1");

    // Isolated node cannot gather quorum
    const clusterIso = new EosRaftCluster("test-iso", ["node-a", "node-b", "node-c"]);
    clusterIso.isolateNode("node-a");
    const isoElection = clusterIso.startElection("node-a");
    assert.equal(isoElection.success, false);
    assert.equal(isoElection.votesReceived, 1); // Only self vote, 1 < 2
  });

  it("BDD-1050: Log entry append, replication, and commit to state machine", () => {
    const cluster = new EosRaftCluster("test-raft-1050", ["node-1", "node-2", "node-3"]);
    cluster.startElection("node-1");

    // Propose first command
    const res1 = cluster.propose({ type: "SET", key: "system_state", value: "OPERATIONAL" });
    assert.equal(res1.success, true);
    assert.equal(res1.committed, true);
    assert.equal(res1.logIndex, 1);
    assert.equal(res1.replicatedCount, 3);

    // Propose second command
    const res2 = cluster.propose({ type: "SET", key: "quantum_epoch", value: 2026 });
    assert.equal(res2.success, true);
    assert.equal(res2.committed, true);
    assert.equal(res2.logIndex, 2);

    // Verify replicated FSM on all nodes
    for (const node of cluster.getAllNodes()) {
      assert.equal(node.commitIndex, 2);
      assert.equal(node.lastApplied, 2);
      assert.deepEqual(node.fsmState, {
        system_state: "OPERATIONAL",
        quantum_epoch: 2026,
      });
    }

    // Verify immutable deepFreeze
    const state = cluster.getNode("node-1")?.fsmState;
    assert.throws(() => {
      // @ts-expect-error mutating frozen object
      state.mutated = true;
    });
  });

  it("BDD-1051: Conflict resolution and stale follower log overwrite", () => {
    const leader = new EosRaftNode("leader-01");
    leader.startElection();
    leader.becomeLeader(["follower-01"]);

    // Leader commits 2 authoritative entries in term 1
    const leaderEntry1 = leader.proposeCommand({ type: "SET", key: "k1", value: "v1" });
    const leaderEntry2 = leader.proposeCommand({ type: "SET", key: "k2", value: "v2" });

    // Follower has conflicting uncommitted entry at index 2 from an older/conflicting term
    const follower = new EosRaftNode("follower-01");
    follower.forceSetTermAndLog(1, [
      leaderEntry1,
      { term: 1, index: 2, command: { type: "SET", key: "k2", value: "CONFLICT" }, entryHash: "stale-hash" },
    ]);

    // Leader sends AppendEntries with authoritative entry 2
    const reply = follower.handleAppendEntries({
      term: 1,
      leaderId: "leader-01",
      prevLogIndex: 1,
      prevLogTerm: 1,
      entries: [leaderEntry2],
      leaderCommit: 2,
    });

    assert.equal(reply.success, true);
    assert.equal(follower.getLastLogIndex(), 2);
    assert.equal(follower.getLogEntry(2)?.command?.value, "v2");
    assert.equal(follower.fsmState.k2, "v2");
  });

  it("BDD-1052: Network partition resilience and split-brain prevention", () => {
    // 5-node cluster
    const cluster = new EosRaftCluster("test-partition-5", ["node-1", "node-2", "node-3", "node-4", "node-5"]);

    // Initial election: node-1 becomes leader of term 1
    const el1 = cluster.startElection("node-1");
    assert.equal(el1.success, true);
    assert.equal(cluster.leaderId, "node-1");

    // Partition: minority [node-1, node-2] vs majority [node-3, node-4, node-5]
    cluster.partition([
      ["node-1", "node-2"],
      ["node-3", "node-4", "node-5"],
    ]);

    // Minority proposal to node-1 cannot reach quorum (needs 3, only has 2)
    const minProposal = cluster.propose({ type: "SET", key: "minority_flag", value: "SHOULD_FAIL" });
    assert.equal(minProposal.committed, false);
    assert.equal(minProposal.replicatedCount, 2);

    // Majority starts election: node-3 collects votes from 3 nodes and becomes leader in term 2
    const majElection = cluster.startElection("node-3");
    assert.equal(majElection.success, true);
    assert.equal(majElection.term, 2);
    assert.equal(cluster.leaderId, "node-3");

    // Majority proposal commits successfully
    const majProposal = cluster.propose({ type: "SET", key: "majority_state", value: "CANONICAL" });
    assert.equal(majProposal.committed, true);
    assert.equal(majProposal.replicatedCount, 3);

    // Heal network partition
    cluster.healPartitions();
    cluster.tick(); // Heartbeat synchronizes minority nodes

    // Verify all nodes converged to majority leader's state
    const node1 = cluster.getNode("node-1");
    assert.equal(node1?.role, "FOLLOWER");
    assert.equal(node1?.currentTerm, 2);
    assert.equal(node1?.fsmState.majority_state, "CANONICAL");
  });

  it("BDD-1053: End-to-end CLI execution, log compaction, and cryptographic state receipt", () => {
    const cluster = new EosRaftCluster("receipt-cluster", ["node-1", "node-2", "node-3"]);
    cluster.startElection("node-1");
    cluster.propose({ type: "SET", key: "audit_level", value: "TIER_0" });
    cluster.propose({ type: "SET", key: "ledger_epoch", value: 1049 });

    // Snapshot log compaction
    const leader = cluster.getNode("node-1");
    assert.ok(leader);
    const snapshot = leader.createSnapshot(2);
    assert.equal(snapshot.lastIncludedIndex, 2);
    assert.equal(snapshot.lastIncludedTerm, 1);
    assert.equal(snapshot.snapshotHash.length, 64);
    assert.deepEqual(snapshot.fsmState, {
      audit_level: "TIER_0",
      ledger_epoch: 1049,
    });

    // Cluster receipt
    const receipt = cluster.generateReceipt("test-nonce-1053");
    assert.equal(receipt.clusterId, "receipt-cluster");
    assert.equal(receipt.commitIndex, 2);
    assert.equal(receipt.activeQuorum, true);
    assert.equal(receipt.fsmStateHash.length, 64);
    assert.equal(receipt.logRootHash.length, 64);
    assert.equal(receipt.sha256Receipt.length, 64);

    // CLI execution validation
    const stdout = execFileSync(process.execPath, ["bin/eos.mjs", "raft:cluster", "--nodes=3", "--json"], {
      encoding: "utf8",
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.election.success, true);
    assert.equal(parsed.proposal.committed, true);
    assert.equal(parsed.status.isQuorumFormed, true);
    assert.equal(parsed.status.quorumSize, 2);
    assert.equal(parsed.receipt.sha256Receipt.length, 64);
  });
});
