/**
 * EOS SYSTEM — LEADER ELECTION WITH QUORUM (Layer 0)
 * Governed by SPEC-170 (Raft / etcd leader election with lease terms)
 *
 * Implements:
 * - Term-based leader election with quorum voting (N/2+1)
 * - Heartbeat-based leadership with lease expiry
 * - Vote-request idempotency and single-vote-per-term safety
 * - Step-down on higher term discovery (split-brain prevention)
 * - Deterministic cluster-state fingerprint
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type NodeRole = "FOLLOWER" | "CANDIDATE" | "LEADER";

export interface ElectionNodeState {
  readonly nodeId: string;
  role: NodeRole;
  currentTerm: number;
  votedFor: string | null;
  leaderId: string | null;
  lastHeartbeatMs: number;
}

export interface VoteResponse {
  readonly voterId: string;
  readonly term: number;
  readonly granted: boolean;
}

export class EosLeaderElectionCluster {
  private readonly nodes: Map<string, ElectionNodeState> = new Map();
  private readonly leaseMs: number;

  constructor(nodeIds: readonly string[], leaseMs = 1500) {
    assertPrecondition(nodeIds.length >= 3, "cluster requires at least 3 nodes for quorum");
    assertPrecondition(new Set(nodeIds).size === nodeIds.length, "node ids must be unique");
    this.leaseMs = leaseMs;
    for (const id of nodeIds) {
      this.nodes.set(id, {
        nodeId: id,
        role: "FOLLOWER",
        currentTerm: 0,
        votedFor: null,
        leaderId: null,
        lastHeartbeatMs: 0,
      });
    }
  }

  get quorumSize(): number {
    return Math.floor(this.nodes.size / 2) + 1;
  }

  /**
   * A node starts an election: increments its term, votes for itself,
   * and collects votes from all other nodes via requestVote.
   * Returns the resulting role, or FOLLOWER if quorum was not reached.
   */
  elect(candidateId: string): NodeRole {
    const candidate = this.nodes.get(candidateId);
    assertPrecondition(candidate !== undefined, `unknown node ${candidateId}`);
    const c = candidate!;

    c.currentTerm += 1;
    c.role = "CANDIDATE";
    c.votedFor = candidateId;

    const votes: VoteResponse[] = [{ voterId: candidateId, term: c.currentTerm, granted: true }];
    for (const [id, node] of this.nodes) {
      if (id === candidateId) continue;
      votes.push(this.requestVote(node, candidateId, c.currentTerm));
    }

    const granted = votes.filter((v) => v.granted).length;
    if (granted >= this.quorumSize) {
      c.role = "LEADER";
      c.leaderId = candidateId;
      for (const [, node] of this.nodes) {
        if (node.nodeId !== candidateId) {
          node.role = "FOLLOWER";
          node.leaderId = candidateId;
          node.currentTerm = Math.max(node.currentTerm, c.currentTerm);
          node.lastHeartbeatMs = Date.now();
        }
      }
    } else {
      c.role = "FOLLOWER";
    }
    return c.role;
  }

  private requestVote(voter: ElectionNodeState, candidateId: string, candidateTerm: number): VoteResponse {
    // Step down on higher term (never regress)
    if (candidateTerm > voter.currentTerm) {
      voter.currentTerm = candidateTerm;
      voter.votedFor = null;
      voter.role = "FOLLOWER";
    }
    if (candidateTerm < voter.currentTerm) {
      return deepFreeze({ voterId: voter.nodeId, term: voter.currentTerm, granted: false });
    }
    // One vote per term safety
    if (voter.votedFor !== null && voter.votedFor !== candidateId) {
      return deepFreeze({ voterId: voter.nodeId, term: voter.currentTerm, granted: false });
    }
    voter.votedFor = candidateId;
    return deepFreeze({ voterId: voter.nodeId, term: voter.currentTerm, granted: true });
  }

  /**
   * Leader heartbeat refreshes follower leases. Any follower that observes
   * a higher term steps its view forward.
   */
  heartbeat(leaderId: string): number {
    const leader = this.nodes.get(leaderId);
    assertPrecondition(leader?.role === "LEADER", `${leaderId} is not leader`);
    const now = Date.now();
    for (const [id, node] of this.nodes) {
      if (id === leaderId) continue;
      node.lastHeartbeatMs = now;
      node.leaderId = leaderId;
      node.currentTerm = Math.max(node.currentTerm, leader!.currentTerm);
    }
    return leader!.currentTerm;
  }

  /**
   * Detects lease expiry; the leader loses authority if a majority has not
   * received a heartbeat within leaseMs.
   */
  checkLease(): { alive: boolean; expiredFollowers: readonly string[] } {
    const now = Date.now();
    const leader = [...this.nodes.values()].find((n) => n.role === "LEADER");
    if (!leader) return deepFreeze({ alive: false, expiredFollowers: [...this.nodes.keys()] });
    const expired = [...this.nodes.values()]
      .filter((n) => n.nodeId !== leader.nodeId && now - n.lastHeartbeatMs > this.leaseMs)
      .map((n) => n.nodeId);
    // Leader step-down if it lost quorum of acked followers
    if (expired.length >= this.quorumSize) {
      leader.role = "FOLLOWER";
      leader.leaderId = null;
      return deepFreeze({ alive: false, expiredFollowers: expired });
    }
    return deepFreeze({ alive: true, expiredFollowers: expired });
  }

  stateOf(nodeId: string): ElectionNodeState | null {
    return this.nodes.get(nodeId) ?? null;
  }

  leader(): string | null {
    const l = [...this.nodes.values()].find((n) => n.role === "LEADER");
    return l ? l.nodeId : null;
  }

  clusterFingerprint(): string {
    const sorted = [...this.nodes.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    return pureSha256(sorted.map((n) => `${n.nodeId}:${n.role}:${n.currentTerm}:${n.votedFor ?? "-"}`).join("|"));
  }
}
