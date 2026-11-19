/**
 * @file eosAgenticSwarmBft.test.mjs
 * @description Automated test suite for SPEC-346 / CHANGE-208 (BDD-1855..BDD-1860).
 * Verifies multi-agent swarm cluster provisioning, PBFT 3-phase consensus, quorum threshold
 * enforcement, byzantine fault detection, automatic agent slashing, dynamic rebalancing,
 * CLI dispatch, and Phase 8 MCP tool integration.
 *
 * Invariant: Pure Layer-0 testing, zero external runtime dependencies, hermetic receipts.
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditAgenticSwarmBft, createSwarmCluster } from "../src/core/eosAgenticSwarmBft.ts";
import { handleAgenticSwarmCommand } from "../bin/commands/cliAgenticSwarmBft.mjs";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

test("SPEC-346 / BDD-1855: Multi-Agent Swarm Cluster Provisioning and Role Assignment", () => {
  const swarm = createSwarmCluster();

  const arch = swarm.registerAgent({ role: "ARCHITECT", id: "agent-arch-01" });
  const coder = swarm.registerAgent({ role: "CODER", id: "agent-coder-01" });
  const sec = swarm.registerAgent({ role: "SECURITY_AUDITOR", id: "agent-sec-01" });
  const verif = swarm.registerAgent({ role: "VERIFIER", id: "agent-verif-01" });

  assert.equal(swarm.listAgents().length, 4);
  assert.equal(swarm.listActiveAgents().length, 4);
  assert.equal(arch.role, "ARCHITECT");
  assert.equal(coder.role, "CODER");
  assert.equal(sec.role, "SECURITY_AUDITOR");
  assert.equal(verif.role, "VERIFIER");

  const q = swarm.getActiveQuorum();
  // For N=4, f=floor(3/3)=1, Q=2(1)+1=3
  assert.equal(q.totalActive, 4);
  assert.equal(q.maxFaulty, 1);
  assert.equal(q.quorum, 3);
});

test("SPEC-346 / BDD-1856: PBFT 3-Phase Consensus Proposal and Preparation", () => {
  const swarm = createSwarmCluster();
  swarm.registerAgent({ role: "ARCHITECT", id: "a1" });
  swarm.registerAgent({ role: "CODER", id: "c1" });
  swarm.registerAgent({ role: "SECURITY_AUDITOR", id: "s1" });
  swarm.registerAgent({ role: "VERIFIER", id: "v1" });

  const round = swarm.submitProposal({
    authorId: "a1",
    proposalType: "SPEC_CHANGE",
    data: { change: "SPEC-346 addition" },
  });

  assert.ok(round.roundId);
  assert.equal(round.phase, "PREPARE");
  assert.equal(round.proposal.digest.length, 64);
  assert.equal(round.status, "IN_PROGRESS");

  // Cast 2 prepares (quorum is 3): should stay in PREPARE phase
  swarm.castPrepare(round.roundId, "a1", "ACCEPT");
  swarm.castPrepare(round.roundId, "c1", "ACCEPT");
  assert.equal(round.phase, "PREPARE");

  // 3rd prepare reaches quorum Q=3: should advance to COMMIT phase
  swarm.castPrepare(round.roundId, "s1", "ACCEPT");
  assert.equal(round.phase, "COMMIT");
});

test("SPEC-346 / BDD-1857: Quorum Threshold Enforcement and Artifact Sealing", () => {
  const swarm = createSwarmCluster();
  swarm.registerAgent({ role: "ARCHITECT", id: "a1" });
  swarm.registerAgent({ role: "CODER", id: "c1" });
  swarm.registerAgent({ role: "SECURITY_AUDITOR", id: "s1" });
  swarm.registerAgent({ role: "VERIFIER", id: "v1" });

  const round = swarm.submitProposal({
    authorId: "a1",
    proposalType: "CODE_PATCH",
    data: { patch: "clean commit" },
  });

  // Complete prepare phase
  swarm.castPrepare(round.roundId, "a1", "ACCEPT");
  swarm.castPrepare(round.roundId, "c1", "ACCEPT");
  swarm.castPrepare(round.roundId, "v1", "ACCEPT");
  assert.equal(round.phase, "COMMIT");

  // Cast 2 commits (below quorum Q=3)
  swarm.castCommit(round.roundId, "a1", "ACCEPT");
  swarm.castCommit(round.roundId, "c1", "ACCEPT");
  assert.equal(round.status, "IN_PROGRESS");

  // 3rd commit achieves quorum
  swarm.castCommit(round.roundId, "v1", "ACCEPT");
  assert.equal(round.phase, "FINALIZED");
  assert.equal(round.status, "CONSENSUS_ACHIEVED");
  assert.ok(round.sealedAt);
});

test("SPEC-346 / BDD-1858: Byzantine Fault Detection and Automatic Agent Slashing", () => {
  const swarm = createSwarmCluster();
  const rogue = swarm.registerAgent({ role: "CODER", id: "rogue-01" });
  swarm.registerAgent({ role: "ARCHITECT", id: "a1" });
  swarm.registerAgent({ role: "SECURITY_AUDITOR", id: "s1" });
  swarm.registerAgent({ role: "VERIFIER", id: "v1" });

  const round = swarm.submitProposal({
    authorId: "a1",
    proposalType: "ARCHITECTURE",
    data: { plan: "secure" },
  });

  // Rogue casts ACCEPT vote
  const v1 = swarm.castPrepare(round.roundId, rogue.id, "ACCEPT");
  assert.equal(v1, true);

  // Rogue attempts contradictory REJECT vote (Equivocation)
  const v2 = swarm.castPrepare(round.roundId, rogue.id, "REJECT");
  assert.equal(v2, false);

  // Agent should be penalized
  assert.equal(rogue.trustScore, 50);

  // Second infraction slashes and isolates the agent
  swarm.slashAgent(rogue.id, "SECOND_MALICIOUS_INFRACTION", 50);
  assert.equal(rogue.trustScore, 0);
  assert.equal(rogue.status, "SLASHED");
});

test("SPEC-346 / BDD-1859: Dynamic Swarm Reconfiguration and Fault Isolation", () => {
  const swarm = createSwarmCluster();
  for (let i = 1; i <= 7; i++) {
    swarm.registerAgent({ role: "CODER", id: `agent-${i}` });
  }

  // N=7: f=2, Q=5
  const q7 = swarm.getActiveQuorum();
  assert.equal(q7.totalActive, 7);
  assert.equal(q7.maxFaulty, 2);
  assert.equal(q7.quorum, 5);

  // Slash 2 agents
  swarm.slashAgent("agent-1", "EQUIVOCATION", 90);
  swarm.slashAgent("agent-2", "UNGROUNDED_PAYLOAD", 90);

  // N=5 active remaining: f=1, Q=3
  const q5 = swarm.getActiveQuorum();
  assert.equal(q5.totalActive, 5);
  assert.equal(q5.maxFaulty, 1);
  assert.equal(q5.quorum, 3);
});

test("SPEC-346 / BDD-1860: Full Swarm BFT Audit, CLI & MCP Tool Invocation", async () => {
  // 1. Audit receipt emission
  const receipt = auditAgenticSwarmBft(ROOT);
  assert.equal(receipt.spec, "SPEC-346");
  assert.equal(receipt.totalAgents, 4);
  assert.equal(receipt.activeQuorum, 3);
  assert.equal(receipt.consensusPassed, true);
  assert.equal(receipt.slashingVerified, true);
  assert.equal(receipt.allPassed, true);
  assert.ok(receipt.sha256.length === 64);

  // 2. CLI Dispatch execution
  const cliAudit = await handleAgenticSwarmCommand({
    command: "toolchain:swarm:audit",
    args: ["--json"],
  });
  assert.equal(cliAudit, true);

  const cliSpawn = await handleAgenticSwarmCommand({
    command: "toolchain:swarm:spawn",
    args: ["--nodes=4", "--json"],
  });
  assert.equal(cliSpawn, true);

  const cliStatus = await handleAgenticSwarmCommand({
    command: "toolchain:swarm:status",
    args: ["--json"],
  });
  assert.equal(cliStatus, true);

  // 3. Phase 8 MCP Tool Execution
  const handlers = createPhase8AgiHandlers({ projectRoot: ROOT });
  assert.ok(typeof handlers.eos_agentic_swarm_bft_audit === "function");
  const mcpReceipt = await handlers.eos_agentic_swarm_bft_audit({});
  assert.equal(mcpReceipt.spec, "SPEC-346");
  assert.equal(mcpReceipt.allPassed, true);
});
