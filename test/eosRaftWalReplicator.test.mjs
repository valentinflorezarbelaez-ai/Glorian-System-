/**
 * EOS SYSTEM — SPEC-071 BDD TEST SUITE
 * Distributed Raft Replication & Multi-Node WAL Synchronizer
 */

import test from "node:test";
import assert from "node:assert/strict";
import { EosRaftWalReplicator } from "../src/core/eosRaftWalReplicator.ts";

test("BDD-217: Raft Leader Election and Majority Quorum", () => {
  const members = ["node-1", "node-2", "node-3"];
  const node1 = new EosRaftWalReplicator("node-1", members);
  const node2 = new EosRaftWalReplicator("node-2", members);
  const node3 = new EosRaftWalReplicator("node-3", members);

  assert.equal(node1.getRole(), "FOLLOWER");
  assert.equal(node1.getQuorumSize(), 2);

  // Node-1 initiates election
  const voteReq = node1.startElection();
  assert.equal(node1.getRole(), "CANDIDATE");
  assert.equal(node1.getCurrentTerm(), 1);

  // Node-2 and Node-3 receive RequestVote
  const reply2 = node2.handleRequestVote(voteReq);
  const reply3 = node3.handleRequestVote(voteReq);

  assert.equal(reply2.voteGranted, true);
  assert.equal(reply3.voteGranted, true);

  // Node-1 records vote from Node-2 -> reaches quorum (2/3) and becomes LEADER
  const electionResult = node1.recordVote("node-2", reply2.voteGranted);
  assert.equal(electionResult.isLeaderNow, true);
  assert.equal(node1.getRole(), "LEADER");
});

test("BDD-218: Multi-Node Replicated Log Commits on Quorum ACK", () => {
  const members = ["node-1", "node-2", "node-3"];
  const leader = new EosRaftWalReplicator("node-1", members);
  const follower = new EosRaftWalReplicator("node-2", members);

  // Promote node-1 to leader in term 1
  leader.startElection();
  leader.recordVote("node-2", true);
  assert.equal(leader.getRole(), "LEADER");

  // Leader proposes a SQLite WAL transaction command
  const { entry, appendArgs } = leader.proposeCommand({
    walFrameLtx: "00000001",
    table: "eos_ledger_entries",
    txId: "tx-1001",
  });

  assert.equal(entry.index, 1);
  assert.equal(leader.getCommitIndex(), 0);

  // Follower processes AppendEntries
  const reply = follower.handleAppendEntries(appendArgs);
  assert.equal(reply.success, true);
  assert.equal(reply.matchIndex, 1);

  // Leader receives ACK from follower -> Quorum 2/3 reached! Commit index advances to 1
  const commitStatus = leader.recordAppendEntriesAck("node-2", reply);
  assert.equal(commitStatus.commitAdvanced, true);
  assert.equal(commitStatus.newCommitIndex, 1);
  assert.equal(leader.getCommitIndex(), 1);

  // Verify state persistence
  const recordResult = leader.recordStateInLedger(":memory:");
  assert.equal(recordResult.recorded, true);
  assert.equal(recordResult.receiptHash.length, 64);
});

test("BDD-219: Raft Consensus Invariants, Log Truncation, and Split-Brain Safety", () => {
  // Preconditions
  assert.throws(() => new EosRaftWalReplicator("", ["n1"]), /NodeId must be non-empty/);
  assert.throws(() => new EosRaftWalReplicator("   ", ["n1"]), /NodeId must be non-empty/);
  assert.throws(() => new EosRaftWalReplicator("n1", []), /Cluster members must contain at least 1 node/);

  // Proposing command when not leader throws
  const followerNode = new EosRaftWalReplicator("n1", ["n1", "n2", "n3"]);
  assert.throws(
    () => followerNode.proposeCommand({ action: "mutate" }),
    /Only the current leader can propose log entries/,
  );

  // getLog()
  assert.equal(followerNode.getLog().length, 0);

  // 5-node cluster election (quorum = 3)
  const cluster5 = ["n1", "n2", "n3", "n4", "n5"];
  const cand = new EosRaftWalReplicator("n1", cluster5);
  assert.equal(cand.getQuorumSize(), 3);

  cand.startElection();
  // Vote not granted
  const resDenied = cand.recordVote("n2", false);
  assert.equal(resDenied.isLeaderNow, false);

  // Vote granted but below quorum (2/3)
  const res1 = cand.recordVote("n2", true);
  assert.equal(res1.isLeaderNow, false);
  assert.equal(cand.getRole(), "CANDIDATE");

  // Vote granted reaching quorum (3/3)
  const res2 = cand.recordVote("n3", true);
  assert.equal(res2.isLeaderNow, true);
  assert.equal(cand.getRole(), "LEADER");

  // Record vote when already leader
  const resAlreadyLeader = cand.recordVote("n4", true);
  assert.equal(resAlreadyLeader.isLeaderNow, true);

  // RequestVote: term obsolete
  const staleVoteReq = { term: 0, candidateId: "n2", lastLogIndex: 0, lastLogTerm: 0 };
  const staleVoteReply = cand.handleRequestVote(staleVoteReq);
  assert.equal(staleVoteReply.voteGranted, false);
  assert.equal(staleVoteReply.reason, "Term obsolete");

  // RequestVote: candidate log not sufficiently up to date
  const leaderWithLogs = new EosRaftWalReplicator("n1", ["n1", "n2"]);
  leaderWithLogs.startElection();
  leaderWithLogs.recordVote("n2", true);
  leaderWithLogs.proposeCommand({ data: "v1" });
  leaderWithLogs.proposeCommand({ data: "v2" }); // log has 2 entries in term 1

  // n2 tries to start election with term 2, but has lastLogIndex 0, lastLogTerm 0
  const underQualifiedVote = leaderWithLogs.handleRequestVote({
    term: 2,
    candidateId: "n2",
    lastLogIndex: 0,
    lastLogTerm: 0,
  });
  assert.equal(underQualifiedVote.voteGranted, false);
  assert.equal(underQualifiedVote.reason, "Candidate log is not sufficiently up-to-date");

  // RequestVote: already voted in same term
  const votingNode = new EosRaftWalReplicator("voter", ["voter", "c1", "c2"]);
  const vote1 = votingNode.handleRequestVote({ term: 1, candidateId: "c1", lastLogIndex: 0, lastLogTerm: 0 });
  assert.equal(vote1.voteGranted, true);
  const vote2 = votingNode.handleRequestVote({ term: 1, candidateId: "c2", lastLogIndex: 0, lastLogTerm: 0 });
  assert.equal(vote2.voteGranted, false);
  assert.equal(vote2.reason, "Already voted in term");

  // AppendEntries: obsolete term
  const appendObsolete = votingNode.handleAppendEntries({
    term: 0,
    leaderId: "c1",
    prevLogIndex: 0,
    prevLogTerm: 0,
    entries: [],
    leaderCommit: 0,
  });
  assert.equal(appendObsolete.success, false);
  assert.equal(appendObsolete.reason, "Leader term is obsolete");

  // AppendEntries: log does not contain prevLogIndex
  const appendMissingPrev = votingNode.handleAppendEntries({
    term: 2,
    leaderId: "c1",
    prevLogIndex: 5,
    prevLogTerm: 1,
    entries: [],
    leaderCommit: 0,
  });
  assert.equal(appendMissingPrev.success, false);
  assert.equal(appendMissingPrev.reason, "Log does not contain prevLogIndex");

  // AppendEntries: term mismatch at prevLogIndex
  const followerWithLog = new EosRaftWalReplicator("f1", ["f1", "l1"]);
  followerWithLog.handleAppendEntries({
    term: 1,
    leaderId: "l1",
    prevLogIndex: 0,
    prevLogTerm: 0,
    entries: [{ index: 1, term: 1, command: { a: 1 }, digest: "d1" }],
    leaderCommit: 0,
  });

  const appendTermMismatch = followerWithLog.handleAppendEntries({
    term: 2,
    leaderId: "l1",
    prevLogIndex: 1,
    prevLogTerm: 99, // mismatch, actual is term 1
    entries: [],
    leaderCommit: 0,
  });
  assert.equal(appendTermMismatch.success, false);
  assert.equal(appendTermMismatch.reason, "Term mismatch at prevLogIndex");

  // AppendEntries: conflicting entry truncation (log replacement)
  const appendConflict = followerWithLog.handleAppendEntries({
    term: 2,
    leaderId: "l1",
    prevLogIndex: 0,
    prevLogTerm: 0,
    entries: [{ index: 1, term: 2, command: { a: 2 }, digest: "d2" }],
    leaderCommit: 1,
  });
  assert.equal(appendConflict.success, true);
  assert.equal(followerWithLog.getLog()[0].term, 2);
  assert.equal(followerWithLog.getCommitIndex(), 1);

  // recordAppendEntriesAck: not leader or failed reply
  const nonLeaderAck = followerWithLog.recordAppendEntriesAck("l1", { term: 2, success: true, matchIndex: 1 });
  assert.equal(nonLeaderAck.commitAdvanced, false);

  const failAck = leaderWithLogs.recordAppendEntriesAck("n2", { term: 1, success: false, matchIndex: 0 });
  assert.equal(failAck.commitAdvanced, false);
});
