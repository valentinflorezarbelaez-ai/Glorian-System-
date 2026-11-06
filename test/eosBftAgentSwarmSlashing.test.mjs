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
    conformsToConstitution: true
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
      conformsToConstitution: false
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
