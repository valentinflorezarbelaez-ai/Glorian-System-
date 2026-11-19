/**
 * @file cliAgenticSwarmBft.mjs
 * @description CLI handler for SPEC-346 / CHANGE-208: Autonomous Multi-Agent Swarm Orchestrator with Byzantine Fault Tolerance.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditAgenticSwarmBft, createSwarmCluster } from "../../src/core/eosAgenticSwarmBft.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("AGENTIC_SWARM_BFT_RECEIPT.json", root);
}

function parseStringFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  return arg ? arg.split("=")[1] : defaultValue;
}

function parseIntFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const parsed = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function buildDefaultSwarm() {
  const swarm = createSwarmCluster();
  swarm.registerAgent({ role: "ARCHITECT", id: "agent-arch" });
  swarm.registerAgent({ role: "CODER", id: "agent-coder" });
  swarm.registerAgent({ role: "SECURITY_AUDITOR", id: "agent-sec" });
  swarm.registerAgent({ role: "VERIFIER", id: "agent-verif" });
  return swarm;
}

const HANDLERS = {};

async function cmd_swarm_spawn(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const nodeCount = parseIntFlag(args, "--nodes=", 4);

  const swarm = createSwarmCluster();
  const roles = ["ARCHITECT", "CODER", "SECURITY_AUDITOR", "VERIFIER", "ORCHESTRATOR"];
  for (let i = 0; i < nodeCount; i++) {
    const role = roles[i % roles.length];
    swarm.registerAgent({ role, id: `agent-${role.toLowerCase()}-${i + 1}` });
  }

  const agents = swarm.listAgents();
  const quorum = swarm.getActiveQuorum();

  if (isJson) {
    console.log(JSON.stringify({ agents, quorum }, null, 2));
  } else {
    console.log("=== Multi-Agent Swarm Spawned (SPEC-346) ===");
    console.log(`Total Agents   : ${agents.length}`);
    console.log(`Quorum (Q)     : ${quorum.quorum} / ${quorum.totalActive} affirmative votes`);
    console.log(`Fault Tolerance: f = ${quorum.maxFaulty} byzantine node(s)`);
    for (const a of agents) {
      console.log(`  - [${a.status}] ${a.id} (${a.role}) Trust: ${a.trustScore}`);
    }
  }
}

async function cmd_swarm_task(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const authorId = parseStringFlag(args, "--author=", "agent-arch");
  const proposalType = parseStringFlag(args, "--type=", "ARCHITECTURE");

  const swarm = buildDefaultSwarm();
  const round = swarm.submitProposal({
    authorId,
    proposalType,
    data: { directive: "Execute mission slice under BFT consensus" },
  });

  if (isJson) {
    console.log(JSON.stringify(round, null, 2));
  } else {
    console.log("=== Multi-Agent Swarm Proposal Submitted ===");
    console.log(`Round ID       : ${round.roundId}`);
    console.log(`Author         : ${round.proposal.authorId}`);
    console.log(`Type           : ${round.proposal.proposalType}`);
    console.log(`Digest         : ${round.proposal.digest}`);
    console.log(`Phase          : ${round.phase}`);
    console.log(`Quorum Needed  : ${round.quorumThreshold}`);
  }
}

async function cmd_swarm_vote(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const voterId = parseStringFlag(args, "--voter=", "agent-coder");
  const decision = parseStringFlag(args, "--decision=", "ACCEPT");

  const swarm = buildDefaultSwarm();
  const round = swarm.submitProposal({
    authorId: "agent-arch",
    proposalType: "CODE_PATCH",
    data: { patch: "autonomous fix" },
  });

  const voteAccepted = swarm.castPrepare(round.roundId, voterId, decision);

  if (isJson) {
    console.log(JSON.stringify({ roundId: round.roundId, voterId, decision, voteAccepted }, null, 2));
  } else {
    console.log("=== Multi-Agent Swarm Vote Cast ===");
    console.log(`Round ID       : ${round.roundId}`);
    console.log(`Voter          : ${voterId}`);
    console.log(`Decision       : ${decision}`);
    console.log(`Vote Accepted  : ${voteAccepted}`);
    console.log(`Current Phase  : ${round.phase}`);
  }
}

async function cmd_swarm_status(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const swarm = buildDefaultSwarm();
  const agents = swarm.listAgents();
  const quorum = swarm.getActiveQuorum();

  if (isJson) {
    console.log(JSON.stringify({ agents, quorum }, null, 2));
  } else {
    console.log("=== Multi-Agent Swarm Status (SPEC-346) ===");
    console.log(`Total Agents   : ${agents.length}`);
    console.log(`Active Quorum  : ${quorum.quorum} / ${quorum.totalActive}`);
    console.log(`Byzantine Tol. : f = ${quorum.maxFaulty}`);
    for (const a of agents) {
      console.log(`  - ${a.id.padEnd(16)} | Role: ${a.role.padEnd(16)} | Trust: ${a.trustScore} | Status: ${a.status}`);
    }
  }
}

async function cmd_swarm_slash(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const targetId = parseStringFlag(args, "--agent=", "agent-coder");
  const reason = parseStringFlag(args, "--reason=", "MANUAL_OPERATOR_SLASH");

  const swarm = buildDefaultSwarm();
  const incident = swarm.slashAgent(targetId, reason, 50);

  if (isJson) {
    console.log(JSON.stringify(incident, null, 2));
  } else {
    console.log("=== Byzantine Agent Slashed ===");
    console.log(`Target Agent   : ${incident.agentId}`);
    console.log(`Reason         : ${incident.reason}`);
    console.log(`Penalty Applied: -${incident.penalty}`);
    console.log(`New Trust Score: ${incident.newTrustScore}`);
  }
}

async function cmd_swarm_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = auditAgenticSwarmBft(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Multi-Agent Swarm BFT Consensus Audit (SPEC-346) ===");
    console.log(`Spec               : ${receipt.spec}`);
    console.log(`Total Agents       : ${receipt.totalAgents}`);
    console.log(`Active Quorum      : ${receipt.activeQuorum}`);
    console.log(`Consensus Passed   : ${receipt.consensusPassed ? "PASS" : "FAIL"}`);
    console.log(`Slashing Verified  : ${receipt.slashingVerified ? "PASS" : "FAIL"}`);
    console.log(`All Passed         : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest     : ${receipt.sha256}`);
    console.log(`Receipt Saved      : ${receiptPath}`);
  }
}

HANDLERS["toolchain:swarm:spawn"] = cmd_swarm_spawn;
HANDLERS["toolchain:swarm:task"] = cmd_swarm_task;
HANDLERS["toolchain:swarm:vote"] = cmd_swarm_vote;
HANDLERS["toolchain:swarm:status"] = cmd_swarm_status;
HANDLERS["toolchain:swarm:slash"] = cmd_swarm_slash;
HANDLERS["toolchain:swarm:audit"] = cmd_swarm_audit;

export async function handleAgenticSwarmCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:swarm command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
