/**
 * Glorian System — Autonomous Multi-Agent Swarm Orchestrator with Byzantine Fault Tolerance Core
 * Governed by SPEC-346 / CHANGE-208
 *
 * Invariants:
 * 1. Pure Layer-0 implementation (dependencies: {}).
 * 2. Strict module line ceiling <= 800 lines with >= 12 lines headroom.
 * 3. 3f+1 Byzantine Fault Tolerance: consensus requires >= 2f + 1 affirmative votes.
 * 4. Automatic slashing and fault isolation for equivocating or malicious agents.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";
import type {
  AgentNode,
  AgentRole,
  ConsensusPhase,
  ConsensusRound,
  ProposalPayload,
  ProposalType,
  SlashingIncident,
  SwarmAuditReceipt,
  VoteDecision,
  VoteEnvelope,
} from "./eosAgenticSwarmBft.types.js";

export class EosAgenticSwarmCluster {
  private readonly agents: Map<string, AgentNode>;
  private readonly rounds: Map<string, ConsensusRound>;
  private readonly slashingLog: SlashingIncident[];

  constructor() {
    this.agents = new Map();
    this.rounds = new Map();
    this.slashingLog = [];
  }

  public registerAgent(spec: { id?: string; role: AgentRole; trustScore?: number; publicKey?: string }): AgentNode {
    const id = spec.id ?? `agent-${spec.role.toLowerCase()}-${this.agents.size + 1}`;
    const node: AgentNode = {
      id,
      role: spec.role,
      trustScore: spec.trustScore ?? 100,
      status: "ACTIVE",
      publicKey: spec.publicKey ?? createHash("sha256").update(id).digest("hex").slice(0, 16),
      createdAt: new Date().toISOString(),
    };
    this.agents.set(id, node);
    return node;
  }

  public getAgent(id: string): AgentNode | undefined {
    return this.agents.get(id);
  }

  public listAgents(): AgentNode[] {
    return Array.from(this.agents.values());
  }

  public listActiveAgents(): AgentNode[] {
    return Array.from(this.agents.values()).filter((a) => a.status === "ACTIVE");
  }

  /**
   * Computes PBFT quorum parameters for active non-faulty nodes:
   * N >= 3f + 1 => f = floor((N - 1) / 3), Quorum Q = 2f + 1.
   */
  public getActiveQuorum(): { totalActive: number; maxFaulty: number; quorum: number } {
    const totalActive = this.listActiveAgents().length;
    const maxFaulty = Math.max(0, Math.floor((totalActive - 1) / 3));
    const quorum = 2 * maxFaulty + 1;
    return { totalActive, maxFaulty, quorum };
  }

  public submitProposal(spec: {
    id?: string;
    authorId: string;
    proposalType: ProposalType;
    data: Record<string, unknown>;
  }): ConsensusRound {
    const author = this.agents.get(spec.authorId);
    if (!author || author.status !== "ACTIVE") {
      throw new Error(`Cannot submit proposal: author '${spec.authorId}' is not an active agent.`);
    }

    const roundId = spec.id ?? `round-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const serializedData = JSON.stringify(spec.data);
    const digest = createHash("sha256").update(serializedData).digest("hex");

    const proposal: ProposalPayload = {
      id: `prop-${roundId}`,
      authorId: spec.authorId,
      proposalType: spec.proposalType,
      data: spec.data,
      digest,
    };

    const { quorum } = this.getActiveQuorum();

    const round: ConsensusRound = {
      roundId,
      phase: "PREPARE",
      proposal,
      prepares: new Map(),
      commits: new Map(),
      quorumThreshold: quorum,
      byzantineFaults: 0,
      status: "IN_PROGRESS",
    };

    this.rounds.set(roundId, round);
    return round;
  }

  public castPrepare(roundId: string, voterId: string, decision: VoteDecision): boolean {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Consensus round '${roundId}' does not exist.`);
    if (round.phase !== "PREPARE" && round.phase !== "PRE_PREPARE") return false;

    const voter = this.agents.get(voterId);
    if (!voter || voter.status !== "ACTIVE") return false;

    // Equivocation Detection: Agent already voted differently on this round
    const existing = round.prepares.get(voterId);
    if (existing) {
      if (existing.decision !== decision || existing.proposalDigest !== round.proposal.digest) {
        this.slashAgent(voterId, "EQUIVOCATION_DETECTED_PREPARE");
        return false;
      }
      return true; // Idempotent same vote
    }

    const envelope: VoteEnvelope = {
      roundId,
      phase: "PREPARE",
      voterId,
      proposalDigest: round.proposal.digest,
      decision,
      signature: createHash("sha256").update(`${roundId}:PREPARE:${voterId}:${decision}`).digest("hex"),
      timestamp: new Date().toISOString(),
    };

    round.prepares.set(voterId, envelope);

    // Tally Prepares
    const affirmativePrepares = Array.from(round.prepares.values()).filter((v) => v.decision === "ACCEPT").length;
    const { quorum } = this.getActiveQuorum();
    round.quorumThreshold = quorum;

    if (affirmativePrepares >= quorum) {
      round.phase = "COMMIT";
    }

    return true;
  }

  public castCommit(roundId: string, voterId: string, decision: VoteDecision): boolean {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Consensus round '${roundId}' does not exist.`);
    if (round.phase !== "COMMIT") return false;

    const voter = this.agents.get(voterId);
    if (!voter || voter.status !== "ACTIVE") return false;

    // Equivocation Detection in commit phase
    const existing = round.commits.get(voterId);
    if (existing) {
      if (existing.decision !== decision || existing.proposalDigest !== round.proposal.digest) {
        this.slashAgent(voterId, "EQUIVOCATION_DETECTED_COMMIT");
        return false;
      }
      return true;
    }

    const envelope: VoteEnvelope = {
      roundId,
      phase: "COMMIT",
      voterId,
      proposalDigest: round.proposal.digest,
      decision,
      signature: createHash("sha256").update(`${roundId}:COMMIT:${voterId}:${decision}`).digest("hex"),
      timestamp: new Date().toISOString(),
    };

    round.commits.set(voterId, envelope);

    // Tally Commits
    const affirmativeCommits = Array.from(round.commits.values()).filter((v) => v.decision === "ACCEPT").length;
    const { quorum } = this.getActiveQuorum();

    if (affirmativeCommits >= quorum) {
      round.phase = "FINALIZED";
      round.status = "CONSENSUS_ACHIEVED";
      round.sealedAt = new Date().toISOString();
    }

    return true;
  }

  public slashAgent(agentId: string, reason: string, penalty = 50): SlashingIncident {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent '${agentId}' not found.`);

    agent.trustScore = Math.max(0, agent.trustScore - penalty);
    if (agent.trustScore <= 20) {
      agent.status = "SLASHED";
    }

    const incident: SlashingIncident = {
      agentId,
      reason,
      timestamp: new Date().toISOString(),
      penalty,
      newTrustScore: agent.trustScore,
    };

    this.slashingLog.push(incident);

    // Track byzantine faults across active rounds
    for (const round of this.rounds.values()) {
      if (round.status === "IN_PROGRESS") {
        round.byzantineFaults++;
      }
    }

    return incident;
  }

  public getRound(roundId: string): ConsensusRound | undefined {
    return this.rounds.get(roundId);
  }

  public listSlashingIncidents(): SlashingIncident[] {
    return [...this.slashingLog];
  }
}

export function createSwarmCluster(): EosAgenticSwarmCluster {
  return new EosAgenticSwarmCluster();
}

/**
 * Executes full deterministic verification of Multi-Agent Swarm and BFT Consensus.
 */
export function auditAgenticSwarmBft(projectRoot = process.cwd()): SwarmAuditReceipt {
  const swarm = createSwarmCluster();

  // 1. Provision 4 Specialized Agents
  const architect = swarm.registerAgent({ role: "ARCHITECT", id: "agent-architect" });
  const coder = swarm.registerAgent({ role: "CODER", id: "agent-coder" });
  const security = swarm.registerAgent({ role: "SECURITY_AUDITOR", id: "agent-security" });
  const verifier = swarm.registerAgent({ role: "VERIFIER", id: "agent-verifier" });

  const qParams = swarm.getActiveQuorum();
  const quorumValid = qParams.totalActive === 4 && qParams.maxFaulty === 1 && qParams.quorum === 3;

  // 2. Submit Architectural Proposal
  const round = swarm.submitProposal({
    id: "round-audit-01",
    authorId: architect.id,
    proposalType: "ARCHITECTURE",
    data: { spec: "SPEC-346", layers: ["L0", "BFT_CONSENSUS"] },
  });

  // 3. Multi-Agent Prepares
  swarm.castPrepare(round.roundId, architect.id, "ACCEPT");
  swarm.castPrepare(round.roundId, coder.id, "ACCEPT");
  swarm.castPrepare(round.roundId, security.id, "ACCEPT");

  const prepared = round.phase === "COMMIT";

  // 4. Multi-Agent Commits
  swarm.castCommit(round.roundId, architect.id, "ACCEPT");
  swarm.castCommit(round.roundId, coder.id, "ACCEPT");
  swarm.castCommit(round.roundId, verifier.id, "ACCEPT");

  const consensusAchieved = round.status === "CONSENSUS_ACHIEVED" && round.phase === "FINALIZED";

  // 5. Test Byzantine Slashing (Equivocation)
  const rogueSwarm = createSwarmCluster();
  const rogue1 = rogueSwarm.registerAgent({ role: "CODER", id: "rogue-agent" });
  rogueSwarm.registerAgent({ role: "ARCHITECT", id: "arch-01" });
  rogueSwarm.registerAgent({ role: "VERIFIER", id: "verif-01" });
  rogueSwarm.registerAgent({ role: "SECURITY_AUDITOR", id: "sec-01" });

  const r2 = rogueSwarm.submitProposal({
    authorId: "arch-01",
    proposalType: "CODE_PATCH",
    data: { patch: "clean" },
  });

  // Rogue votes ACCEPT
  rogueSwarm.castPrepare(r2.roundId, rogue1.id, "ACCEPT");
  // Rogue attempts contradictory REJECT vote (Equivocation attack)
  rogueSwarm.castPrepare(r2.roundId, rogue1.id, "REJECT");

  const incidents = rogueSwarm.listSlashingIncidents();
  const slashingVerified =
    incidents.length > 0 && incidents.some((i) => i.agentId === "rogue-agent" && i.reason.includes("EQUIVOCATION"));

  const allPassed = quorumValid && prepared && consensusAchieved && slashingVerified;

  const receipt: SwarmAuditReceipt = {
    spec: "SPEC-346",
    timestamp: new Date().toISOString(),
    totalAgents: swarm.listAgents().length,
    activeQuorum: qParams.quorum,
    consensusPassed: consensusAchieved,
    slashingVerified,
    allPassed,
    sha256: "",
  };

  const receiptPayload = JSON.stringify(receipt, null, 2);
  receipt.sha256 = createHash("sha256").update(receiptPayload).digest("hex");

  const receiptPath = resolveEvidencePath("AGENTIC_SWARM_BFT_RECEIPT.json", projectRoot);
  try {
    const parentDir = path.dirname(receiptPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch {
    // Hermetic receipt write fallback
  }

  return receipt;
}
