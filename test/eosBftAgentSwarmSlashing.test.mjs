/**
 * EOS SYSTEM — SPEC-065 BDD TEST SUITE
 * BFT Agent Swarm & Slashing Hypervisor
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EosBftAgentSwarmSlashing } from "../src/core/eosBftAgentSwarmSlashing.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

test("BDD-196: Supermajority BFT Consensus Voting", () => {
  const swarm = EosBftAgentSwarmSlashing.createDefaultSwarm();
  const proposal = {
    proposalId: "PROP-771",
    patchHash: "sha256:11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
    authorAgentId: "agent_architect",
    testsExitCode: 0,
    conformsToConstitution: true,
  };

  const report = EosBftAgentSwarmSlashing.evaluateConsensus(swarm, proposal);

  assert.equal(report.verdict, "CONSENSUS_REACHED");
  assert.equal(report.votesFor, 4);
  assert.equal(report.quorumThreshold, 3);
  assert.equal(report.slashedAgents.length, 0);
  assert.equal(report.sha256Receipt.length, 64);

  // Check that honest agents were rewarded
  assert.equal(swarm[0].stake, 105);
  assert.equal(swarm[1].stake, 105);
});

test("BDD-197: Malicious Mutation Detection and Slashing Execution", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-swarm-test-"));
  const ledgerPath = path.join(tmpDir, "ledger.sqlite");

  try {
    const swarm = EosBftAgentSwarmSlashing.createDefaultSwarm();
    const maliciousProposal = {
      proposalId: "PROP-999-BYZANTINE",
      patchHash: "sha256:badbeefbadbeefbadbeefbadbeefbadbeefbadbeefbadbeefbadbeefbadbeef",
      authorAgentId: "agent_architect",
      testsExitCode: 1, // Failing tests, breaking Mandamiento II
      conformsToConstitution: false,
    };

    const report = EosBftAgentSwarmSlashing.evaluateConsensus(swarm, maliciousProposal);

    assert.equal(report.verdict, "BYZANTINE_SLASHING_TRIPPED");
    assert.equal(report.slashedAgents.length, 1);
    assert.equal(report.slashedAgents[0], "agent_architect");

    // Verify slashing deduction: 100 - 50 = 50
    assert.equal(swarm[0].stake, 50);
    assert.equal(swarm[0].isSlashed, true);

    // Verify Ledger persistence
    const saved = EosBftAgentSwarmSlashing.recordReceiptInLedger(report, ledgerPath);
    assert.equal(saved, true);

    const ledger = new EosDurableSqliteLedger(ledgerPath);
    const recent = ledger.listRecent(5);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].category, "SECURITY_AUDIT");
    ledger.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-198: Security Veto Overrides Swarm Vote", () => {
  const swarm = EosBftAgentSwarmSlashing.createDefaultSwarm();
  const proposalWithVeto = {
    proposalId: "PROP-SECURITY-VETO",
    patchHash: "sha256:3333444455556666777788889999000011112222333344445555666677778888",
    authorAgentId: "agent_architect",
    hasSecurityVeto: true,
    testsExitCode: 0,
    conformsToConstitution: true,
  };

  const report = EosBftAgentSwarmSlashing.evaluateConsensus(swarm, proposalWithVeto);

  assert.equal(report.verdict, "VETOED_BY_SECURITY");
  assert.equal(report.vetoTriggered, true);
  assert.equal(report.votesAgainst, 1);
  assert.equal(report.votesFor, 3);
  assert.equal(report.slashedAgents.length, 0);
});

test("BDD-199: Preconditions and Slashed Inactive Agent Exclusion", () => {
  // Precondition: Swarm must have at least 4 agents
  assert.throws(
    () => EosBftAgentSwarmSlashing.evaluateConsensus([], { proposalId: "PROP-EMPTY" }),
    /Swarm requires at least 4 agents/,
  );

  // Precondition: proposalId required
  const defaultSwarm = EosBftAgentSwarmSlashing.createDefaultSwarm();
  assert.throws(() => EosBftAgentSwarmSlashing.evaluateConsensus(defaultSwarm, {}), /proposalId is required/);

  // Slashed agent exclusion & stake floor at zero
  const swarmWithSlashed = EosBftAgentSwarmSlashing.createDefaultSwarm();
  swarmWithSlashed[0].isSlashed = true; // Slashed agent cannot vote
  swarmWithSlashed[1].stake = 20; // Stake lower than SLASH_AMOUNT (50) to verify Math.max(0, ...)

  const maliciousProp = {
    proposalId: "PROP-SLASH-FLOOR",
    patchHash: "sha256:eeeeffff00001111222233334444555566667777888899990000111122223333",
    authorAgentId: "agent_security",
    conformsToConstitution: false,
    testsExitCode: 1,
  };

  const report = EosBftAgentSwarmSlashing.evaluateConsensus(swarmWithSlashed, maliciousProp);
  assert.equal(report.verdict, "BYZANTINE_SLASHING_TRIPPED");
  assert.equal(swarmWithSlashed[1].stake, 0); // Floored to 0
  assert.equal(swarmWithSlashed[1].isSlashed, true);
  assert.equal(report.activeVotersCount, 2); // 2 remaining non-slashed agents
});

test("BDD-200: Quorum Not Met and Directory / Fallback Ledger Paths", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-swarm-dir-"));

  try {
    // Construct scenario where votesFor < quorumThreshold (e.g. 2 already slashed agents out of 4)
    const swarm = EosBftAgentSwarmSlashing.createDefaultSwarm();
    swarm[0].isSlashed = true;
    swarm[1].isSlashed = true;
    // 2 active voters left, so votesFor will be 2, but quorum is ceil((2*4 + 1)/3) = 3
    const normalProp = {
      proposalId: "PROP-NO-QUORUM",
      patchHash: "sha256:aaaaabbbbbcccccdddddeeeeefffff00000111112222233333444445555566666",
      authorAgentId: "agent_architect",
      testsExitCode: 0,
      conformsToConstitution: true,
    };

    const report = EosBftAgentSwarmSlashing.evaluateConsensus(swarm, normalProp);
    assert.equal(report.verdict, "QUORUM_NOT_MET");
    assert.equal(report.votesFor, 2);

    // Test recordReceiptInLedger with directory (triggers defaultLedgerPath(dbPathOrRootDir))
    const savedInDir = EosBftAgentSwarmSlashing.recordReceiptInLedger(report, tmpDir);
    assert.equal(savedInDir, true);

    // Test recordReceiptInLedger with .db extension
    const dbFilePath = path.join(tmpDir, "custom.db");
    const savedInDb = EosBftAgentSwarmSlashing.recordReceiptInLedger(report, dbFilePath);
    assert.equal(savedInDb, true);

    // Test error handling in recordReceiptInLedger (catch branch)
    const failed = EosBftAgentSwarmSlashing.recordReceiptInLedger(null, tmpDir);
    assert.equal(failed, false);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});
