/**
 * EOS SYSTEM — DISTRIBUTED RAFT REPLICATION & MULTI-NODE WAL SYNCHRONIZER (Layer 0)
 * Governed by SPEC-071, CHANGE-060, ADR-076, FR-246..FR-249, BDD-217..BDD-218 (v68.0.0)
 *
 * Implements Ongaro & Ousterhout's Raft consensus protocol for multi-node SQLite WAL synchronization.
 * Guarantees term monotonicity, leader election quorum, log matching safety, and commit consensus.
 *
 * Zero external runtime npm dependencies (Law V). Node 24 strip-only compliant.
 */

import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export type RaftRole = "FOLLOWER" | "CANDIDATE" | "LEADER";

export interface RaftLogEntry {
  readonly index: number;
  readonly term: number;
  readonly command: Readonly<Record<string, unknown>>;
  readonly digest: string;
}

export interface RequestVoteArgs {
  readonly term: number;
  readonly candidateId: string;
  readonly lastLogIndex: number;
  readonly lastLogTerm: number;
}

export interface RequestVoteReply {
  readonly term: number;
  readonly voteGranted: boolean;
  readonly reason?: string;
}

export interface AppendEntriesArgs {
  readonly term: number;
  readonly leaderId: string;
  readonly prevLogIndex: number;
  readonly prevLogTerm: number;
  readonly entries: readonly RaftLogEntry[];
  readonly leaderCommit: number;
}

export interface AppendEntriesReply {
  readonly term: number;
  readonly success: boolean;
  readonly matchIndex: number;
  readonly reason?: string;
}

export class EosRaftWalReplicator {
  public readonly nodeId: string;
  public readonly clusterMembers: readonly string[];
  private role: RaftRole = "FOLLOWER";
  private currentTerm: number = 0;
  private votedFor: string | null = null;
  private readonly log: RaftLogEntry[] = [];
  private commitIndex: number = 0;
  private votesReceived: Set<string> = new Set();
  private readonly matchIndexes: Map<string, number> = new Map();

  constructor(nodeId: string, clusterMembers: readonly string[]) {
    assertPrecondition(Boolean(nodeId && nodeId.trim()), "NodeId must be non-empty");
    assertPrecondition(clusterMembers.length >= 1, "Cluster members must contain at least 1 node");
    this.nodeId = nodeId.trim();
    this.clusterMembers = Object.freeze([...clusterMembers]);
  }

  public getRole(): RaftRole {
    return this.role;
  }

  public getCurrentTerm(): number {
    return this.currentTerm;
  }

  public getCommitIndex(): number {
    return this.commitIndex;
  }

  public getLog(): readonly RaftLogEntry[] {
    return Object.freeze([...this.log]);
  }

  public getQuorumSize(): number {
    return Math.floor(this.clusterMembers.length / 2) + 1;
  }

  /**
   * Starts an election round: transitions to CANDIDATE, increments term, votes for self.
   */
  public startElection(): RequestVoteArgs {
    this.currentTerm++;
    this.role = "CANDIDATE";
    this.votedFor = this.nodeId;
    this.votesReceived = new Set([this.nodeId]);

    const lastLogIndex = this.log.length;
    const lastLogTerm = this.log.length > 0 ? this.log[this.log.length - 1].term : 0;

    return deepFreeze({
      term: this.currentTerm,
      candidateId: this.nodeId,
      lastLogIndex,
      lastLogTerm
    });
  }

  /**
   * Evaluates an incoming RequestVote message.
   */
  public handleRequestVote(req: RequestVoteArgs): RequestVoteReply {
    if (req.term > this.currentTerm) {
      this.currentTerm = req.term;
      this.role = "FOLLOWER";
      this.votedFor = null;
    }

    if (req.term < this.currentTerm) {
      return { term: this.currentTerm, voteGranted: false, reason: "Term obsolete" };
    }

    const canVote = this.votedFor === null || this.votedFor === req.candidateId;
    const lastIndex = this.log.length;
    const lastTerm = this.log.length > 0 ? this.log[this.log.length - 1].term : 0;

    const logUpToDate =
      req.lastLogTerm > lastTerm ||
      (req.lastLogTerm === lastTerm && req.lastLogIndex >= lastIndex);

    if (canVote && logUpToDate) {
      this.votedFor = req.candidateId;
      return { term: this.currentTerm, voteGranted: true };
    }

    return {
      term: this.currentTerm,
      voteGranted: false,
      reason: !canVote ? "Already voted in term" : "Candidate log is not sufficiently up-to-date"
    };
  }

  /**
   * Records a granted vote and checks if majority quorum has been achieved.
   */
  public recordVote(fromNodeId: string, granted: boolean): { readonly isLeaderNow: boolean } {
    if (this.role !== "CANDIDATE" || !granted) {
      return { isLeaderNow: this.role === "LEADER" };
    }

    this.votesReceived.add(fromNodeId);
    if (this.votesReceived.size >= this.getQuorumSize()) {
      this.role = "LEADER";
      this.matchIndexes.clear();
      for (const m of this.clusterMembers) {
        this.matchIndexes.set(m, 0);
      }
      return { isLeaderNow: true };
    }

    return { isLeaderNow: false };
  }

  /**
   * Leader proposes a new command to append to the replicated log.
   */
  public proposeCommand(command: Record<string, unknown>): {
    readonly entry: RaftLogEntry;
    readonly appendArgs: AppendEntriesArgs;
  } {
    assertPrecondition(this.role === "LEADER", "Only the current leader can propose log entries");

    const index = this.log.length + 1;
    const prevLogIndex = this.log.length;
    const prevLogTerm = this.log.length > 0 ? this.log[this.log.length - 1].term : 0;

    const digest = pureSha256(`${index}:${this.currentTerm}:${JSON.stringify(command)}`);
    const entry: RaftLogEntry = deepFreeze({
      index,
      term: this.currentTerm,
      command: deepFreeze({ ...command }),
      digest
    });

    this.log.push(entry);
    this.matchIndexes.set(this.nodeId, index);

    const appendArgs: AppendEntriesArgs = deepFreeze({
      term: this.currentTerm,
      leaderId: this.nodeId,
      prevLogIndex,
      prevLogTerm,
      entries: [entry],
      leaderCommit: this.commitIndex
    });

    return { entry, appendArgs };
  }

  /**
   * Follower handles incoming AppendEntries RPC (heartbeat or new entries).
   */
  public handleAppendEntries(req: AppendEntriesArgs): AppendEntriesReply {
    if (req.term > this.currentTerm) {
      this.currentTerm = req.term;
      this.role = "FOLLOWER";
      this.votedFor = null;
    }

    if (req.term < this.currentTerm) {
      return {
        term: this.currentTerm,
        success: false,
        matchIndex: this.commitIndex,
        reason: "Leader term is obsolete"
      };
    }

    // Acknowledge current leader
    this.role = "FOLLOWER";

    // Verify prevLogIndex and prevLogTerm
    if (req.prevLogIndex > 0) {
      if (this.log.length < req.prevLogIndex) {
        return {
          term: this.currentTerm,
          success: false,
          matchIndex: this.log.length,
          reason: "Log does not contain prevLogIndex"
        };
      }
      if (this.log[req.prevLogIndex - 1].term !== req.prevLogTerm) {
        return {
          term: this.currentTerm,
          success: false,
          matchIndex: req.prevLogIndex - 1,
          reason: "Term mismatch at prevLogIndex"
        };
      }
    }

    // Append new entries not already in log
    for (const entry of req.entries) {
      const idx = entry.index;
      if (idx <= this.log.length) {
        if (this.log[idx - 1].term !== entry.term) {
          // Truncate conflicting entries
          this.log.splice(idx - 1);
          this.log.push(entry);
        }
      } else {
        this.log.push(entry);
      }
    }

    // Advance commitIndex if leader has committed further
    if (req.leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(req.leaderCommit, this.log.length);
    }

    return {
      term: this.currentTerm,
      success: true,
      matchIndex: this.log.length
    };
  }

  /**
   * Leader records follower ACK and advances commitIndex if quorum is achieved.
   */
  public recordAppendEntriesAck(followerId: string, reply: AppendEntriesReply): {
    readonly commitAdvanced: boolean;
    readonly newCommitIndex: number;
  } {
    if (this.role !== "LEADER" || !reply.success) {
      return { commitAdvanced: false, newCommitIndex: this.commitIndex };
    }

    this.matchIndexes.set(followerId, reply.matchIndex);

    // Find the highest N where N > commitIndex, a majority of matchIndex >= N, and log[N-1].term == currentTerm
    const oldCommit = this.commitIndex;
    for (let n = this.log.length; n > this.commitIndex; n--) {
      if (this.log[n - 1].term === this.currentTerm) {
        let count = 0;
        for (const idx of this.matchIndexes.values()) {
          if (idx >= n) count++;
        }
        if (count >= this.getQuorumSize()) {
          this.commitIndex = n;
          break;
        }
      }
    }

    return {
      commitAdvanced: this.commitIndex > oldCommit,
      newCommitIndex: this.commitIndex
    };
  }

  /**
   * Persists Raft state snapshot to SQLite WAL ledger.
   */
  public recordStateInLedger(
    ledgerPath?: string
  ): { readonly recorded: boolean; readonly receiptHash: string } {
    const ledger = new EosDurableSqliteLedger(ledgerPath || ":memory:");
    try {
      const entry = ledger.appendEntry({
        category: "ARCHITECTURE_DECISION",
        projectId: "eos-system",
        title: `Raft Consensus State: node=${this.nodeId}, role=${this.role}, term=${this.currentTerm}`,
        payload: {
          nodeId: this.nodeId,
          role: this.role,
          currentTerm: this.currentTerm,
          commitIndex: this.commitIndex,
          logLength: this.log.length,
          quorumSize: this.getQuorumSize()
        }
      });
      return { recorded: true, receiptHash: entry.entryHash };
    } finally {
      ledger.close();
    }
  }
}
