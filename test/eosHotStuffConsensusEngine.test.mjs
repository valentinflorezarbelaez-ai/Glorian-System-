import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { EosHotStuffConsensusEngine, HOTSTUFF_GENESIS_HASH } from "../src/core/eosHotStuffConsensusEngine.ts";
import { dispatchPhase7FrontierActionExt } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts";

const CLUSTER = ["node-1", "node-2", "node-3", "node-4"];

test("BDD-1134: Quorum Certificate Formation and Multi-Signature Aggregation", () => {
  const engine = new EosHotStuffConsensusEngine("node-1", CLUSTER);
  assert.strictEqual(engine.quorumSize, 3);
  assert.strictEqual(engine.faultTolerance, 1);

  // Leader proposes block B1
  const b1 = engine.createProposal({ tx: "genesis_tx_01" });
  assert.strictEqual(b1.view, 1);
  assert.strictEqual(b1.parentHash, HOTSTUFF_GENESIS_HASH);
  assert.strictEqual(b1.proposer, "node-1");

  // Replicas vote for B1
  const v1 = engine.vote(b1);
  assert.ok(v1 !== null);
  assert.strictEqual(v1.voter, "node-1");

  const v2 = {
    view: 1,
    blockHash: b1.hash,
    phase: "prepare",
    voter: "node-2",
    signature: "sig-node-2",
  };
  const v3 = {
    view: 1,
    blockHash: b1.hash,
    phase: "prepare",
    voter: "node-3",
    signature: "sig-node-3",
  };

  const qc1 = engine.receiveVote(v2);
  assert.strictEqual(qc1, null, "Quorum size 3 not met with 2 votes");

  const qcFinal = engine.receiveVote(v3);
  assert.ok(qcFinal !== null, "Quorum size 3 met with 3 votes");
  assert.strictEqual(qcFinal.view, 1);
  assert.strictEqual(qcFinal.blockHash, b1.hash);
  assert.strictEqual(Object.keys(qcFinal.signatures).length, 3);
  assert.strictEqual(engine.highQC.qcHash, qcFinal.qcHash);
});

test("BDD-1135: Voting Safety Predicate and Lock-QC Enforcement", () => {
  const replica = new EosHotStuffConsensusEngine("node-2", CLUSTER);

  // Simulate established lockedQC at view 2 for block B_locked
  const bLocked = {
    hash: "hash_block_locked_v2",
    parentHash: HOTSTUFF_GENESIS_HASH,
    view: 2,
    proposer: "node-2",
    payload: { state: "locked" },
    justify: replica.highQC,
    timestamp: new Date().toISOString(),
  };

  const lockedQc = {
    view: 2,
    blockHash: bLocked.hash,
    phase: "precommit",
    signatures: { "node-1": "s1", "node-2": "s2", "node-3": "s3" },
    qcHash: "qc_locked_hash",
  };

  // Step 1: Conflicting proposal that does NOT extend B_locked and has justify.view <= lockedQC.view
  const conflictingProposal = {
    hash: "conflicting_hash_v3",
    parentHash: "other_branch_hash",
    view: 3,
    proposer: "node-3",
    payload: { attack: true },
    justify: {
      view: 1,
      blockHash: "other_branch_hash",
      phase: "prepare",
      signatures: { "node-1": "s1", "node-2": "s2", "node-3": "s3" },
      qcHash: "old_qc_hash",
    },
    timestamp: new Date().toISOString(),
  };

  // Inject lockedQC into replica
  const bParent = replica.createProposal({ tx: "initial" });
  replica.vote(bParent);
  // Force simulate lockedQC state
  Object.defineProperty(replica, "lockedQcState", { value: lockedQc, writable: true });

  const voteResult = replica.vote(conflictingProposal);
  assert.strictEqual(voteResult, null, "Must reject proposal violating safety predicate");

  // Step 2: Valid proposal extending locked block
  const validProposal = {
    hash: "valid_extension_hash",
    parentHash: bLocked.hash,
    view: 3,
    proposer: "node-3",
    payload: { valid: true },
    justify: lockedQc,
    timestamp: new Date().toISOString(),
  };
  // Register bLocked in replica tree
  replica["blocks"].set(bLocked.hash, bLocked);

  const validVote = replica.vote(validProposal);
  assert.ok(validVote !== null, "Must accept proposal extending lockedQC block");
  assert.strictEqual(validVote.blockHash, validProposal.hash);
});

test("BDD-1136: Three-Chain Pipelined Commit Rule", () => {
  const engine = new EosHotStuffConsensusEngine("node-1", CLUSTER);

  // View 1: Block 1
  const b1 = engine.createProposal({ data: "payload_1" });
  engine.vote(b1);
  engine.receiveVote({ view: 1, blockHash: b1.hash, phase: "prepare", voter: "node-2", signature: "s2" });
  const qc1 = engine.receiveVote({ view: 1, blockHash: b1.hash, phase: "prepare", voter: "node-3", signature: "s3" });
  assert.ok(qc1 !== null);

  // View 2: Block 2 (extends B1, justified by QC1)
  engine.advanceView();
  const b2 = engine.createProposal({ data: "payload_2" });
  engine.vote(b2);
  engine.receiveVote({ view: 2, blockHash: b2.hash, phase: "prepare", voter: "node-2", signature: "s2" });
  const qc2 = engine.receiveVote({ view: 2, blockHash: b2.hash, phase: "prepare", voter: "node-3", signature: "s3" });
  assert.ok(qc2 !== null);

  // View 3: Block 3 (extends B2, justified by QC2)
  engine.advanceView();
  const b3 = engine.createProposal({ data: "payload_3" });
  engine.vote(b3);
  engine.receiveVote({ view: 3, blockHash: b3.hash, phase: "prepare", voter: "node-2", signature: "s2" });
  const qc3 = engine.receiveVote({ view: 3, blockHash: b3.hash, phase: "prepare", voter: "node-3", signature: "s3" });
  assert.ok(qc3 !== null);

  // View 4: Block 4 (extends B3, justified by QC3)
  engine.advanceView();
  const b4 = engine.createProposal({ data: "payload_4" });

  // Process 3-chain commit on arrival of B4
  const commitRes = engine.processCommitRule(b4);
  assert.strictEqual(commitRes.committedBlocks.length, 1);
  assert.strictEqual(commitRes.committedBlocks[0].hash, b1.hash, "3-chain commits B1");

  const committedList = engine.getCommittedBlocks();
  assert.ok(committedList.some((b) => b.hash === b1.hash));
});

test("BDD-1137: Linear Pacemaker View Change and Leader Rotation", () => {
  const engine = new EosHotStuffConsensusEngine("node-1", CLUSTER);

  assert.strictEqual(engine.currentView, 1);
  assert.strictEqual(engine.getLeader(1), "node-1");

  assert.strictEqual(engine.advanceView(), 2);
  assert.strictEqual(engine.getLeader(), "node-2");

  assert.strictEqual(engine.advanceView(), 3);
  assert.strictEqual(engine.getLeader(), "node-3");

  assert.strictEqual(engine.advanceView(), 4);
  assert.strictEqual(engine.getLeader(), "node-4");

  // Round-robin wrap around to node-1
  assert.strictEqual(engine.advanceView(), 5);
  assert.strictEqual(engine.getLeader(), "node-1");
});

test("BDD-1138: Equivocation Slashing and CLI/MCP Dispatch", () => {
  const engine = new EosHotStuffConsensusEngine("node-1", CLUSTER);

  // Malicious node emits 2 different votes for view 5
  const voteA = {
    view: 5,
    blockHash: "block_A_hash",
    phase: "prepare",
    voter: "node-4",
    signature: "sigA",
  };
  const voteB = {
    view: 5,
    blockHash: "block_B_hash",
    phase: "prepare",
    voter: "node-4",
    signature: "sigB",
  };

  assert.strictEqual(engine.detectEquivocation(voteA, voteB), true);

  engine.receiveVote(voteA);
  const slashRes = engine.receiveVote(voteB);
  assert.strictEqual(slashRes, null, "Equivocating vote rejected from QC");

  const slashed = engine.getSlashedValidators();
  assert.ok(slashed.has("node-4"));
  const receipt = slashed.get("node-4");
  assert.strictEqual(receipt.violator, "node-4");
  assert.strictEqual(receipt.view, 5);

  // CLI execution verification
  const statusOutput = execSync("node bin/eos.mjs hotstuff:status --json", {
    encoding: "utf-8",
  });
  const statusJson = JSON.parse(statusOutput);
  assert.strictEqual(statusJson.nodeId, "node-1");
  assert.strictEqual(statusJson.quorumSize, 3);

  const proposeOutput = execSync("node bin/eos.mjs hotstuff:propose --json", {
    encoding: "utf-8",
  });
  const proposeJson = JSON.parse(proposeOutput);
  assert.strictEqual(proposeJson.algorithm, "HotStuff Pipelined BFT");
  assert.ok(proposeJson.blockHash.length === 64);

  // MCP Dispatch
  const fakeDeps = {};
  const mcpPropose = dispatchPhase7FrontierActionExt("hotstuff_propose", { node: "node-2" }, fakeDeps);
  assert.strictEqual(mcpPropose.action, "hotstuff_propose");
  assert.strictEqual(mcpPropose.nodeId, "node-2");

  const mcpVote = dispatchPhase7FrontierActionExt("hotstuff_vote", { node: "node-2" }, fakeDeps);
  assert.strictEqual(mcpVote.action, "hotstuff_vote");
  assert.strictEqual(mcpVote.accepted, true);

  const mcpStatus = dispatchPhase7FrontierActionExt("hotstuff_status", {}, fakeDeps);
  assert.strictEqual(mcpStatus.action, "hotstuff_status");
  assert.strictEqual(mcpStatus.quorumSize, 3);
});
