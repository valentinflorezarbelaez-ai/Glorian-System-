/**
 * SPEC-359 / CHANGE-221: Autonomous Self-Assembling Agent Swarm Micro-Kernel with Raft/Paxos Formal Leadership & Dynamic Capability Mesh
 * Type Definitions & Contracts.
 */

export type SwarmRaftRole = "FOLLOWER" | "CANDIDATE" | "LEADER";

export type SwarmSpecializedRole =
  "LEAD_ARCHITECT" | "STATIC_AUDITOR" | "TEST_SYNTHESIZER" | "BENCHMARK_PROFILER" | "SECURITY_GATEKEEPER";

export interface CapabilityVector {
  readonly agentId: string;
  readonly skills: readonly string[];
  readonly computeWeight: number;
  readonly reliabilityScore: number;
}

export interface SwarmLogEntry {
  readonly index: number;
  readonly term: number;
  readonly command: string;
  readonly payload: Record<string, unknown>;
  committed: boolean;
}

export interface SwarmAgentNode {
  readonly id: string;
  role: SwarmRaftRole;
  specializedRole?: SwarmSpecializedRole;
  currentTerm: number;
  votedFor: string | null;
  readonly capabilities: CapabilityVector;
  lastHeartbeat: number;
}

export interface RaftMessage {
  readonly type: "REQUEST_VOTE" | "VOTE_RESPONSE" | "APPEND_ENTRIES" | "APPEND_RESPONSE";
  readonly term: number;
  readonly from: string;
  readonly to: string;
  readonly granted?: boolean;
  readonly entries?: readonly SwarmLogEntry[];
}

export interface SwarmBenchmarkResult {
  readonly electionsExecuted: number;
  readonly totalDurationUs: number;
  readonly avgConvergenceTimeUs: number;
  readonly consensusThroughputOpsSec: number;
  readonly splitBrainViolations: number;
}

export interface SwarmAuditReceipt {
  readonly specId: "SPEC-359";
  readonly changeId: "CHANGE-221";
  readonly timestamp: string;
  readonly swarmSize: number;
  readonly currentLeader: string | null;
  readonly currentTerm: number;
  readonly benchmark: SwarmBenchmarkResult;
  readonly tlcModelVerified: boolean;
  readonly verdict: "CONFORMANT";
  readonly epistemicState: "PRODUCTION_READY_WITHIN_TESTED_SCOPE";
}
