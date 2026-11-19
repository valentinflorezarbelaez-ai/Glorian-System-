/**
 * @file cliAgentSwarmMicroKernel.mjs
 * @description CLI handler for SPEC-359 / CHANGE-221: Autonomous Self-Assembling Agent Swarm Micro-Kernel with Raft/Paxos Formal Leadership.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosRaftConsensusEngine,
  EosSwarmCapabilityMesh,
  EosSwarmMicroKernelCore,
} from "../../src/core/eosAgentSwarmMicroKernel.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("AGENT_SWARM_MICROKERNEL_RECEIPT.json", root);
}

const HANDLERS = {};

function createSampleSwarm() {
  const caps = [
    {
      agentId: "agent-lead",
      skills: ["ARCH", "TLA_SPEC", "OPENSPEC_DESIGN"],
      computeWeight: 10,
      reliabilityScore: 0.99,
    },
    {
      agentId: "agent-sec",
      skills: ["SECRET_SCAN", "OWASP_AUDIT", "SLSA_PROVENANCE"],
      computeWeight: 8,
      reliabilityScore: 0.98,
    },
    { agentId: "agent-test", skills: ["BDD_TEST", "UNIT_TEST", "FUZZING"], computeWeight: 7, reliabilityScore: 0.95 },
    {
      agentId: "agent-bench",
      skills: ["PERF_AUDIT", "SIMD_BENCH", "LATENCY_PROFILE"],
      computeWeight: 9,
      reliabilityScore: 0.96,
    },
    {
      agentId: "agent-audit",
      skills: ["LINT", "TYPECHECK", "HYGIENE_GOVERNOR"],
      computeWeight: 6,
      reliabilityScore: 0.92,
    },
  ];
  const engine = new EosRaftConsensusEngine(caps);
  EosSwarmCapabilityMesh.assignRoles(engine.getNodes());
  return engine;
}

async function cmd_swarm_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosSwarmMicroKernelCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Agent Swarm Micro-Kernel (SPEC-359) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Swarm Size              : ${receipt.swarmSize} agents`);
    console.log(`Current Leader          : ${receipt.currentLeader}`);
    console.log(`Current Term            : ${receipt.currentTerm}`);
    console.log(`Elections Executed      : ${receipt.benchmark.electionsExecuted}`);
    console.log(`Avg Convergence Time    : ${receipt.benchmark.avgConvergenceTimeUs.toFixed(1)} µs`);
    console.log(
      `Throughput              : ${Math.round(receipt.benchmark.consensusThroughputOpsSec).toLocaleString()} ops/sec`,
    );
    console.log(`Split-Brain Violations  : ${receipt.benchmark.splitBrainViolations}`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelVerified ? "PASS" : "FAIL"}`);
    console.log(`Verdict                 : ${receipt.verdict}`);
    console.log(`Epistemic State         : ${receipt.epistemicState}`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_swarm_status(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const swarm = createSampleSwarm();
  swarm.triggerElection("agent-lead");

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          leaderId: swarm.getLeaderId(),
          quorum: swarm.getQuorum(),
          nodes: swarm.getNodes(),
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== Agent Swarm Status & Capability Mesh ===");
    console.log(`Leader ID : ${swarm.getLeaderId()}`);
    console.log(`Quorum    : ${swarm.getQuorum()} / ${swarm.getNodes().length}`);
    for (const n of swarm.getNodes()) {
      console.log(`  - [${n.role}] ${n.id} -> ${n.specializedRole || "WORKER"} (Term: ${n.currentTerm})`);
    }
  }
}

async function cmd_swarm_elect(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const positionalArgs = args.filter((a) => a !== commandContext.command && !a.startsWith("-"));
  const candidateId = positionalArgs[0] || "agent-sec";

  const swarm = createSampleSwarm();
  const elected = swarm.triggerElection(candidateId);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          candidateId,
          elected,
          leaderId: swarm.getLeaderId(),
          term: swarm.getNode(candidateId)?.currentTerm,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`=== Raft Election Round ===`);
    console.log(`Candidate   : ${candidateId}`);
    console.log(`Elected     : ${elected ? "SUCCESS" : "FAILED"}`);
    console.log(`New Leader  : ${swarm.getLeaderId()}`);
    console.log(`Term        : ${swarm.getNode(candidateId)?.currentTerm}`);
  }
}

async function cmd_swarm_propose(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const positionalArgs = args.filter((a) => a !== commandContext.command && !a.startsWith("-"));
  const cmd = positionalArgs[0] || "SEAL_GATE";

  const swarm = createSampleSwarm();
  swarm.triggerElection("agent-lead");
  const entry = swarm.proposeCommand(cmd, { timestamp: Date.now(), specId: "SPEC-359" });

  if (isJson) {
    console.log(JSON.stringify(entry, null, 2));
  } else {
    console.log(`=== Replicated Log Entry Proposed ===`);
    console.log(`Index     : ${entry.index}`);
    console.log(`Term      : ${entry.term}`);
    console.log(`Command   : ${entry.command}`);
    console.log(`Committed : ${entry.committed ? "YES (Quorum Acked)" : "NO"}`);
  }
}

HANDLERS["toolchain:kernel:audit"] = cmd_swarm_audit;
HANDLERS["toolchain:kernel:status"] = cmd_swarm_status;
HANDLERS["toolchain:kernel:elect"] = cmd_swarm_elect;
HANDLERS["toolchain:kernel:propose"] = cmd_swarm_propose;

export async function handleAgentSwarmMicroKernelCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:kernel command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
