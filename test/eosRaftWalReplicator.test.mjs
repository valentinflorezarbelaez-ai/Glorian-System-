/**
 * EOS SYSTEM — SPEC-071 BDD TEST SUITE
 * Distributed Raft Replication & Multi-Node WAL Synchronizer
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosRaftWalReplicator } from '../src/core/eosRaftWalReplicator.ts';

test('BDD-217: Raft Leader Election and Majority Quorum', () => {
  const members = ['node-1', 'node-2', 'node-3'];
  const node1 = new EosRaftWalReplicator('node-1', members);
  const node2 = new EosRaftWalReplicator('node-2', members);
  const node3 = new EosRaftWalReplicator('node-3', members);

  assert.equal(node1.getRole(), 'FOLLOWER');
  assert.equal(node1.getQuorumSize(), 2);

  // Node-1 initiates election
  const voteReq = node1.startElection();
  assert.equal(node1.getRole(), 'CANDIDATE');
  assert.equal(node1.getCurrentTerm(), 1);

  // Node-2 and Node-3 receive RequestVote
  const reply2 = node2.handleRequestVote(voteReq);
  const reply3 = node3.handleRequestVote(voteReq);

  assert.equal(reply2.voteGranted, true);
  assert.equal(reply3.voteGranted, true);

  // Node-1 records vote from Node-2 -> reaches quorum (2/3) and becomes LEADER
  const electionResult = node1.recordVote('node-2', reply2.voteGranted);
  assert.equal(electionResult.isLeaderNow, true);
  assert.equal(node1.getRole(), 'LEADER');
});

test('BDD-218: Multi-Node Replicated Log Commits on Quorum ACK', () => {
  const members = ['node-1', 'node-2', 'node-3'];
  const leader = new EosRaftWalReplicator('node-1', members);
  const follower = new EosRaftWalReplicator('node-2', members);

  // Promote node-1 to leader in term 1
  leader.startElection();
  leader.recordVote('node-2', true);
  assert.equal(leader.getRole(), 'LEADER');

  // Leader proposes a SQLite WAL transaction command
  const { entry, appendArgs } = leader.proposeCommand({
    walFrameLtx: '00000001',
    table: 'eos_ledger_entries',
    txId: 'tx-1001'
  });

  assert.equal(entry.index, 1);
  assert.equal(leader.getCommitIndex(), 0);

  // Follower processes AppendEntries
  const reply = follower.handleAppendEntries(appendArgs);
  assert.equal(reply.success, true);
  assert.equal(reply.matchIndex, 1);

  // Leader receives ACK from follower -> Quorum 2/3 reached! Commit index advances to 1
  const commitStatus = leader.recordAppendEntriesAck('node-2', reply);
  assert.equal(commitStatus.commitAdvanced, true);
  assert.equal(commitStatus.newCommitIndex, 1);
  assert.equal(leader.getCommitIndex(), 1);

  // Verify state persistence
  const recordResult = leader.recordStateInLedger(':memory:');
  assert.equal(recordResult.recorded, true);
  assert.equal(recordResult.receiptHash.length, 64);
});
