/**
 * Glorian System — Autonomous Multi-Agent Swarm Orchestrator with Byzantine Fault Tolerance Types
 * Governed by SPEC-346 / CHANGE-208
 *
 * Invariant: Pure Layer-0 types with zero external dependencies.
 */

export type AgentRole = "ARCHITECT" | "CODER" | "SECURITY_AUDITOR" | "VERIFIER" | "ORCHESTRATOR";

export type AgentStatus = "ACTIVE" | "BUSY" | "SLASHED" | "QUARANTINED";

export interface AgentNode {
  id: string;
  role: AgentRole;
  trustScore: number;
  status: AgentStatus;
  publicKey: string;
  createdAt: string;
}

export type ConsensusPhase = "PRE_PREPARE" | "PREPARE" | "COMMIT" | "FINALIZED" | "FAILED";

export type ProposalType = "ARCHITECTURE" | "CODE_PATCH" | "SPEC_CHANGE" | "REFACTOR";

export interface ProposalPayload {
  id: string;
  authorId: string;
  proposalType: ProposalType;
  data: Record<string, unknown>;
  digest: string;
}

export type VoteDecision = "ACCEPT" | "REJECT";

export interface VoteEnvelope {
  roundId: string;
  phase: "PREPARE" | "COMMIT";
  voterId: string;
  proposalDigest: string;
  decision: VoteDecision;
  signature: string;
  timestamp: string;
}

export interface ConsensusRound {
  roundId: string;
  phase: ConsensusPhase;
  proposal: ProposalPayload;
  prepares: Map<string, VoteEnvelope>;
  commits: Map<string, VoteEnvelope>;
  quorumThreshold: number;
  byzantineFaults: number;
  status: "IN_PROGRESS" | "CONSENSUS_ACHIEVED" | "CONSENSUS_FAILED";
  sealedAt?: string;
}

export interface SlashingIncident {
  agentId: string;
  reason: string;
  timestamp: string;
  penalty: number;
  newTrustScore: number;
}

export interface SwarmAuditReceipt {
  spec: string;
  timestamp: string;
  totalAgents: number;
  activeQuorum: number;
  consensusPassed: boolean;
  slashingVerified: boolean;
  allPassed: boolean;
  sha256: string;
}
