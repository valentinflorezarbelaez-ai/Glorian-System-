/**
 * EosRaftConsensusEngine (Layer 0 — Distributed Raft Consensus Engine with Replicated FSM)
 * Governed by SPEC-206, CHANGE-091, ADR-091, FR-1049..FR-1053, BDD-1049..BDD-1053 (v76.0.0)
 *
 * Implements:
 * - Stanford Raft Consensus Protocol (Ongaro & Ousterhout, 2014) in pure TypeScript.
 * - Dynamic role transitions: FOLLOWER, CANDIDATE, LEADER.
 * - Leader election with majority quorums (floor(N/2) + 1).
 * - Log replication with AppendEntries RPC and log matching invariant.
 * - Stale log conflict detection, rollback, truncation, and alignment.
 * - Linearizable replicated state machine (FSM) command execution.
 * - In-memory network partition simulation, split-brain safety, and post-partition healing.
 * - Merkle/SHA-256 snapshotting and tamper-evident consensus receipts.
 *
 * Strictly ZERO external runtime dependencies (Law V). Node 24 strip-only compliant.
 */

import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type RaftRole = "FOLLOWER" | "CANDIDATE" | "LEADER";

export interface RaftLogEntry {
  readonly term: number;
  readonly index: number;
  readonly command: unknown;
  readonly entryHash: string;
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
  readonly conflictIndex?: number;
  readonly conflictTerm?: number;
}

export interface RaftNodeStatus {
  readonly nodeId: string;
  readonly role: RaftRole;
  readonly currentTerm: number;
  readonly votedFor: string | null;
  readonly commitIndex: number;
  readonly lastApplied: number;
  readonly logLength: number;
  readonly lastLogTerm: number;
  readonly fsmState: Readonly<Record<string, unknown>>;
}

export interface RaftClusterStatus {
  readonly clusterId: string;
  readonly leaderId: string | null;
  readonly currentTerm: number;
  readonly quorumSize: number;
  readonly nodeCount: number;
  readonly isQuorumFormed: boolean;
  readonly nodes: readonly RaftNodeStatus[];
  readonly partitionGroups: readonly (readonly string[])[];
}

export interface RaftSnapshot {
  readonly lastIncludedIndex: number;
  readonly lastIncludedTerm: number;
  readonly fsmState: Readonly<Record<string, unknown>>;
  readonly snapshotHash: string;
}

export interface RaftClusterReceipt {
  readonly clusterId: string;
  readonly currentTerm: number;
  readonly leaderId: string | null;
  readonly commitIndex: number;
  readonly activeQuorum: boolean;
  readonly nodeCount: number;
  readonly fsmStateHash: string;
  readonly logRootHash: string;
  readonly sha256Receipt: string;
  readonly generatedAt: string;
}

export type FsmReducer = (state: Record<string, unknown>, command: unknown) => Record<string, unknown>;

function defaultFsmReducer(state: Record<string, unknown>, command: unknown): Record<string, unknown> {
  if (typeof command === "object" && command !== null) {
    const cmd = command as Record<string, unknown>;
    if (cmd.type === "SET" && typeof cmd.key === "string") {
      return { ...state, [cmd.key]: cmd.value };
    }
    if (cmd.type === "DELETE" && typeof cmd.key === "string") {
      const next = { ...state };
      delete next[cmd.key];
      return next;
    }
    if (cmd.type === "APPEND" && typeof cmd.key === "string" && Array.isArray(state[cmd.key])) {
      const list = state[cmd.key] as unknown[];
      return { ...state, [cmd.key]: [...list, cmd.value] };
    }
  }
  return state;
}

function computeLogEntryHash(term: number, index: number, command: unknown): string {
  return pureSha256(JSON.stringify({ term, index, command }));
}

function computeFsmHash(state: Record<string, unknown>): string {
  const sortedKeys = Object.keys(state).sort();
  const canonical: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    canonical[k] = state[k];
  }
  return pureSha256(JSON.stringify(canonical));
}

/**
 * Individual Node inside the Raft consensus cluster.
 */
export class EosRaftNode {
  readonly nodeId: string;
  private _role: RaftRole = "FOLLOWER";
  private _currentTerm = 0;
  private _votedFor: string | null = null;
  private _log: RaftLogEntry[] = [];
  private _commitIndex = 0;
  private _lastApplied = 0;
  private _fsmState: Record<string, unknown> = {};
  private readonly _fsmReducer: FsmReducer;

  // Leader-specific volatile state (peerId -> nextIndex / matchIndex)
  private readonly _nextIndex = new Map<string, number>();
  private readonly _matchIndex = new Map<string, number>();

  // Snapshot support
  private _lastIncludedIndex = 0;
  private _lastIncludedTerm = 0;

  constructor(nodeId: string, customReducer?: FsmReducer) {
    assertPrecondition(typeof nodeId === "string" && nodeId.trim().length > 0, "nodeId must be non-empty string");
    this.nodeId = nodeId;
    this._fsmReducer = customReducer ?? defaultFsmReducer;
  }

  get role(): RaftRole {
    return this._role;
  }

  get currentTerm(): number {
    return this._currentTerm;
  }

  get votedFor(): string | null {
    return this._votedFor;
  }

  get commitIndex(): number {
    return this._commitIndex;
  }

  get lastApplied(): number {
    return this._lastApplied;
  }

  get logLength(): number {
    return this._log.length + this._lastIncludedIndex;
  }

  get fsmState(): Readonly<Record<string, unknown>> {
    return deepFreeze({ ...this._fsmState });
  }

  getLastLogIndex(): number {
    if (this._log.length > 0) {
      return this._log[this._log.length - 1].index;
    }
    return this._lastIncludedIndex;
  }

  getLastLogTerm(): number {
    if (this._log.length > 0) {
      return this._log[this._log.length - 1].term;
    }
    return this._lastIncludedTerm;
  }

  getLogEntry(index: number): RaftLogEntry | null {
    const offset = index - this._lastIncludedIndex - 1;
    if (offset >= 0 && offset < this._log.length) {
      return this._log[offset];
    }
    return null;
  }

  getLogEntriesFrom(fromIndex: number): readonly RaftLogEntry[] {
    const offset = fromIndex - this._lastIncludedIndex - 1;
    if (offset < 0) {
      return [...this._log];
    }
    return this._log.slice(offset);
  }

  /**
   * Transition node to candidate state and increment term.
   */
  startElection(): RequestVoteArgs {
    this._role = "CANDIDATE";
    this._currentTerm += 1;
    this._votedFor = this.nodeId; // Vote for self

    return {
      term: this._currentTerm,
      candidateId: this.nodeId,
      lastLogIndex: this.getLastLogIndex(),
      lastLogTerm: this.getLastLogTerm(),
    };
  }

  /**
   * Become leader after receiving majority quorum.
   */
  becomeLeader(peerIds: readonly string[]): void {
    assertPrecondition(this._role === "CANDIDATE", "Only candidate can transition to leader");
    this._role = "LEADER";
    const lastIndex = this.getLastLogIndex();

    this._nextIndex.clear();
    this._matchIndex.clear();

    for (const peer of peerIds) {
      if (peer !== this.nodeId) {
        this._nextIndex.set(peer, lastIndex + 1);
        this._matchIndex.set(peer, 0);
      }
    }
  }

  /**
   * Step down to follower in term.
   */
  stepDown(newTerm: number): void {
    if (newTerm > this._currentTerm) {
      this._currentTerm = newTerm;
      this._votedFor = null;
    }
    this._role = "FOLLOWER";
  }

  /**
   * Append a new command to leader's log.
   */
  proposeCommand(command: unknown): RaftLogEntry {
    assertPrecondition(this._role === "LEADER", "Only leader can propose commands to log");
    const index = this.getLastLogIndex() + 1;
    const term = this._currentTerm;
    const entryHash = computeLogEntryHash(term, index, command);

    const entry: RaftLogEntry = { term, index, command, entryHash };
    this._log.push(entry);

    return entry;
  }

  /**
   * Handle incoming RequestVote RPC.
   */
  handleRequestVote(args: RequestVoteArgs): RequestVoteReply {
    // 1. Reply false if term < currentTerm
    if (args.term < this._currentTerm) {
      return { term: this._currentTerm, voteGranted: false, reason: "Term too low" };
    }

    // Update term if candidate has higher term
    if (args.term > this._currentTerm) {
      this._currentTerm = args.term;
      this._role = "FOLLOWER";
      this._votedFor = null;
    }

    // 2. Check if already voted for someone else in this term
    const canVoteForCandidate = this._votedFor === null || this._votedFor === args.candidateId;
    if (!canVoteForCandidate) {
      return { term: this._currentTerm, voteGranted: false, reason: "Already voted for other candidate" };
    }

    // 3. Check candidate's log up-to-dateness (Raft §5.4.1)
    const myLastTerm = this.getLastLogTerm();
    const myLastIndex = this.getLastLogIndex();

    const candidateIsUpToDate =
      args.lastLogTerm > myLastTerm || (args.lastLogTerm === myLastTerm && args.lastLogIndex >= myLastIndex);

    if (candidateIsUpToDate) {
      this._votedFor = args.candidateId;
      return { term: this._currentTerm, voteGranted: true };
    }

    return { term: this._currentTerm, voteGranted: false, reason: "Candidate log not up to date" };
  }

  /**
   * Handle incoming AppendEntries RPC (Heartbeat & Log Replication).
   */
  handleAppendEntries(args: AppendEntriesArgs): AppendEntriesReply {
    // 1. Reply false if term < currentTerm
    if (args.term < this._currentTerm) {
      return { term: this._currentTerm, success: false, matchIndex: this.getLastLogIndex() };
    }

    // If higher term or candidate encountering valid leader, revert to follower
    if (args.term > this._currentTerm || this._role === "CANDIDATE") {
      this._currentTerm = args.term;
      this._role = "FOLLOWER";
      this._votedFor = null;
    }

    // 2. Reply false if log doesn't contain entry at prevLogIndex matching prevLogTerm
    if (args.prevLogIndex > 0) {
      const prevEntry = this.getLogEntry(args.prevLogIndex);
      if (args.prevLogIndex > this.getLastLogIndex()) {
        return {
          term: this._currentTerm,
          success: false,
          matchIndex: this.getLastLogIndex(),
          conflictIndex: this.getLastLogIndex() + 1,
        };
      }
      if (prevEntry && prevEntry.term !== args.prevLogTerm) {
        // Find first index of conflicting term
        const conflictTerm = prevEntry.term;
        let conflictIndex = args.prevLogIndex;
        for (let idx = args.prevLogIndex - 1; idx > this._lastIncludedIndex; idx--) {
          const e = this.getLogEntry(idx);
          if (e && e.term === conflictTerm) {
            conflictIndex = idx;
          } else {
            break;
          }
        }
        return {
          term: this._currentTerm,
          success: false,
          matchIndex: this.getLastLogIndex(),
          conflictIndex,
          conflictTerm,
        };
      }
    }

    // 3. Truncate conflicting entries and append new ones
    for (let i = 0; i < args.entries.length; i++) {
      const newEntry = args.entries[i];
      const existingEntry = this.getLogEntry(newEntry.index);

      if (existingEntry) {
        if (existingEntry.term !== newEntry.term || existingEntry.entryHash !== newEntry.entryHash) {
          // Conflict: truncate log starting at this index
          const offset = newEntry.index - this._lastIncludedIndex - 1;
          this._log = this._log.slice(0, offset);
          this._log.push(newEntry);
        }
        // Identical: do nothing
      } else {
        // Append new entry
        this._log.push(newEntry);
      }
    }

    // 4. Update commitIndex
    if (args.leaderCommit > this._commitIndex) {
      this._commitIndex = Math.min(args.leaderCommit, this.getLastLogIndex());
      this.applyCommittedEntries();
    }

    return {
      term: this._currentTerm,
      success: true,
      matchIndex: this.getLastLogIndex(),
    };
  }

  /**
   * Apply all committed but unapplied entries to the replicated FSM.
   */
  applyCommittedEntries(): number {
    let appliedCount = 0;
    while (this._commitIndex > this._lastApplied) {
      this._lastApplied += 1;
      const entry = this.getLogEntry(this._lastApplied);
      if (entry) {
        this._fsmState = this._fsmReducer(this._fsmState, entry.command);
        appliedCount += 1;
      }
    }
    return appliedCount;
  }

  /**
   * Leader updates matchIndex and nextIndex for peer and evaluates commitIndex advancement.
   */
  leaderUpdatePeerProgress(
    peerId: string,
    matchIndex: number,
    clusterSize: number,
  ): { newlyCommitted: boolean; commitIndex: number } {
    assertPrecondition(this._role === "LEADER", "Only leader updates peer progress");
    this._matchIndex.set(peerId, matchIndex);
    this._nextIndex.set(peerId, matchIndex + 1);

    // Evaluate majority quorum for commit index
    let newlyCommitted = false;
    const lastIndex = this.getLastLogIndex();

    for (let n = lastIndex; n > this._commitIndex; n--) {
      const entry = this.getLogEntry(n);
      // Leader can only commit log entries from its current term (Raft §5.4.2)
      if (entry && entry.term === this._currentTerm) {
        let matchCount = 1; // Count leader self
        for (const [pId, pMatch] of this._matchIndex.entries()) {
          if (pId !== this.nodeId && pMatch >= n) {
            matchCount += 1;
          }
        }
        const quorum = Math.floor(clusterSize / 2) + 1;
        if (matchCount >= quorum) {
          this._commitIndex = n;
          this.applyCommittedEntries();
          newlyCommitted = true;
          break;
        }
      }
    }

    return { newlyCommitted, commitIndex: this._commitIndex };
  }

  getPeerNextIndex(peerId: string): number {
    return this._nextIndex.get(peerId) ?? this.getLastLogIndex() + 1;
  }

  decrementPeerNextIndex(peerId: string, hintIndex?: number): void {
    const current = this.getPeerNextIndex(peerId);
    if (typeof hintIndex === "number" && hintIndex > 0 && hintIndex < current) {
      this._nextIndex.set(peerId, hintIndex);
    } else {
      this._nextIndex.set(peerId, Math.max(1, current - 1));
    }
  }

  /**
   * Compacts log up to given index and snapshots FSM state.
   */
  createSnapshot(uptoIndex?: number): RaftSnapshot {
    const targetIndex = uptoIndex ?? this._commitIndex;
    assertPrecondition(targetIndex <= this._commitIndex, "Cannot snapshot beyond commitIndex");
    assertPrecondition(targetIndex > this._lastIncludedIndex, "Target index must exceed last snapshot");

    const entry = this.getLogEntry(targetIndex);
    assertPrecondition(entry !== null, "Target log entry must exist for snapshot");

    this._lastIncludedIndex = targetIndex;
    this._lastIncludedTerm = entry!.term;

    const offset = targetIndex - (this._lastIncludedIndex - this._log.length);
    // Keep only entries after targetIndex
    const retainOffset = this._log.findIndex((e) => e.index > targetIndex);
    if (retainOffset >= 0) {
      this._log = this._log.slice(retainOffset);
    } else {
      this._log = [];
    }

    const snapshotHash = pureSha256(
      JSON.stringify({
        lastIncludedIndex: this._lastIncludedIndex,
        lastIncludedTerm: this._lastIncludedTerm,
        fsmState: this._fsmState,
      }),
    );

    return deepFreeze({
      lastIncludedIndex: this._lastIncludedIndex,
      lastIncludedTerm: this._lastIncludedTerm,
      fsmState: deepFreeze({ ...this._fsmState }),
      snapshotHash,
    });
  }

  getStatus(): RaftNodeStatus {
    return deepFreeze({
      nodeId: this.nodeId,
      role: this._role,
      currentTerm: this._currentTerm,
      votedFor: this._votedFor,
      commitIndex: this._commitIndex,
      lastApplied: this._lastApplied,
      logLength: this.logLength,
      lastLogTerm: this.getLastLogTerm(),
      fsmState: deepFreeze({ ...this._fsmState }),
    });
  }

  forceSetTermAndLog(term: number, entries: readonly RaftLogEntry[]): void {
    this._currentTerm = term;
    this._log = [...entries];
  }
}

/**
 * Cluster Coordinator managing multiple Raft nodes, simulated networking,
 * quorums, partitions, and tamper-evident consensus receipts.
 */
export class EosRaftCluster {
  readonly clusterId: string;
  private readonly _nodes = new Map<string, EosRaftNode>();
  private _leaderId: string | null = null;
  private _partitionGroups: string[][] = [];

  constructor(clusterId = "raft-cluster-01", nodeIds: readonly string[] = ["node-1", "node-2", "node-3"]) {
    assertPrecondition(typeof clusterId === "string" && clusterId.trim().length > 0, "clusterId must be valid");
    assertPrecondition(nodeIds.length >= 1, "At least 1 node required in cluster");

    this.clusterId = clusterId;
    for (const id of nodeIds) {
      this._nodes.set(id, new EosRaftNode(id));
    }
  }

  get nodeCount(): number {
    return this._nodes.size;
  }

  get quorumSize(): number {
    return Math.floor(this._nodes.size / 2) + 1;
  }

  get leaderId(): string | null {
    return this._leaderId;
  }

  getNode(nodeId: string): EosRaftNode | undefined {
    return this._nodes.get(nodeId);
  }

  getAllNodes(): readonly EosRaftNode[] {
    return Array.from(this._nodes.values());
  }

  /**
   * Check if two nodes can communicate under current network partition configuration.
   */
  canCommunicate(fromId: string, toId: string): boolean {
    if (this._partitionGroups.length === 0) {
      return true;
    }
    for (const group of this._partitionGroups) {
      if (group.includes(fromId) && group.includes(toId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Configure partition isolation groups.
   * Nodes can only communicate if they belong to the same group.
   */
  partition(groups: readonly (readonly string[])[]): void {
    assertPrecondition(groups.length >= 1, "At least 1 group required to partition");
    this._partitionGroups = groups.map((g) => [...g]);
  }

  /**
   * Isolate a single node into its own minority partition.
   */
  isolateNode(isolatedId: string): void {
    const remaining = Array.from(this._nodes.keys()).filter((id) => id !== isolatedId);
    this._partitionGroups = [[isolatedId], remaining];
  }

  /**
   * Heal all network partitions, restoring full mesh connectivity.
   */
  healPartitions(): void {
    this._partitionGroups = [];
  }

  /**
   * Trigger an election for candidateId or the first available follower.
   */
  startElection(candidateId?: string): { success: boolean; term: number; votesReceived: number } {
    const candidate = candidateId
      ? this._nodes.get(candidateId)
      : (Array.from(this._nodes.values()).find((n) => n.role !== "LEADER") ?? Array.from(this._nodes.values())[0]);

    if (!candidate) {
      return { success: false, term: 0, votesReceived: 0 };
    }

    const voteArgs = candidate.startElection();
    let votesReceived = 1; // Votes for self

    for (const [peerId, peer] of this._nodes.entries()) {
      if (peerId !== candidate.nodeId) {
        if (!this.canCommunicate(candidate.nodeId, peerId)) {
          continue; // Dropped by partition
        }
        const reply = peer.handleRequestVote(voteArgs);
        if (reply.term > candidate.currentTerm) {
          candidate.stepDown(reply.term);
          if (this._leaderId === candidate.nodeId) {
            this._leaderId = null;
          }
          return { success: false, term: reply.term, votesReceived };
        }
        if (reply.voteGranted) {
          votesReceived += 1;
        }
      }
    }

    if (votesReceived >= this.quorumSize) {
      candidate.becomeLeader(Array.from(this._nodes.keys()));
      this._leaderId = candidate.nodeId;
      this.syncHeartbeats();
      return { success: true, term: candidate.currentTerm, votesReceived };
    }

    return { success: false, term: candidate.currentTerm, votesReceived };
  }

  /**
   * Broadcast AppendEntries RPC (or heartbeats) from leader to peers.
   */
  syncHeartbeats(): { success: boolean; acknowledgments: number } {
    if (!this._leaderId) {
      return { success: false, acknowledgments: 0 };
    }

    const leader = this._nodes.get(this._leaderId);
    if (!leader || leader.role !== "LEADER") {
      this._leaderId = null;
      return { success: false, acknowledgments: 0 };
    }

    let acks = 1; // Leader self

    for (const [peerId, peer] of this._nodes.entries()) {
      if (peerId === leader.nodeId) continue;
      if (!this.canCommunicate(leader.nodeId, peerId)) continue;

      const prevIndex = leader.getPeerNextIndex(peerId) - 1;
      const prevTerm = prevIndex > 0 ? (leader.getLogEntry(prevIndex)?.term ?? 0) : 0;
      const entriesToSend = leader.getLogEntriesFrom(prevIndex + 1);

      const args: AppendEntriesArgs = {
        term: leader.currentTerm,
        leaderId: leader.nodeId,
        prevLogIndex: prevIndex,
        prevLogTerm: prevTerm,
        entries: entriesToSend,
        leaderCommit: leader.commitIndex,
      };

      const reply = peer.handleAppendEntries(args);

      if (reply.term > leader.currentTerm) {
        leader.stepDown(reply.term);
        this._leaderId = null;
        return { success: false, acknowledgments: acks };
      }

      if (reply.success) {
        acks += 1;
        leader.leaderUpdatePeerProgress(peerId, reply.matchIndex, this._nodes.size);
      } else {
        leader.decrementPeerNextIndex(peerId, reply.conflictIndex);
      }
    }

    return { success: acks >= this.quorumSize, acknowledgments: acks };
  }

  /**
   * Propose a client command to the current cluster leader.
   */
  propose(command: unknown): {
    success: boolean;
    committed: boolean;
    leaderId: string | null;
    term: number;
    logIndex: number;
    replicatedCount: number;
  } {
    assertPrecondition(command !== undefined, "Command must be defined");

    if (!this._leaderId) {
      return {
        success: false,
        committed: false,
        leaderId: null,
        term: 0,
        logIndex: 0,
        replicatedCount: 0,
      };
    }

    const leader = this._nodes.get(this._leaderId);
    if (!leader || leader.role !== "LEADER") {
      this._leaderId = null;
      return {
        success: false,
        committed: false,
        leaderId: null,
        term: 0,
        logIndex: 0,
        replicatedCount: 0,
      };
    }

    // Leader appends command to local log
    const entry = leader.proposeCommand(command);
    let replicatedCount = 1; // Leader itself

    // Replicate across peers
    for (const [peerId, peer] of this._nodes.entries()) {
      if (peerId === leader.nodeId) continue;
      if (!this.canCommunicate(leader.nodeId, peerId)) continue;

      let success = false;
      let attempts = 0;

      while (!success && attempts < 10) {
        attempts += 1;
        const prevIndex = leader.getPeerNextIndex(peerId) - 1;
        const prevTerm = prevIndex > 0 ? (leader.getLogEntry(prevIndex)?.term ?? 0) : 0;
        const entriesToSend = leader.getLogEntriesFrom(prevIndex + 1);

        const args: AppendEntriesArgs = {
          term: leader.currentTerm,
          leaderId: leader.nodeId,
          prevLogIndex: prevIndex,
          prevLogTerm: prevTerm,
          entries: entriesToSend,
          leaderCommit: leader.commitIndex,
        };

        const reply = peer.handleAppendEntries(args);

        if (reply.term > leader.currentTerm) {
          leader.stepDown(reply.term);
          this._leaderId = null;
          return {
            success: false,
            committed: false,
            leaderId: null,
            term: reply.term,
            logIndex: entry.index,
            replicatedCount,
          };
        }

        if (reply.success) {
          success = true;
          replicatedCount += 1;
          leader.leaderUpdatePeerProgress(peerId, reply.matchIndex, this._nodes.size);
        } else {
          leader.decrementPeerNextIndex(peerId, reply.conflictIndex);
        }
      }
    }

    const isCommitted = replicatedCount >= this.quorumSize;
    if (isCommitted) {
      // Broadcast updated commitIndex to all reachable peers
      this.syncHeartbeats();
    }

    return {
      success: true,
      committed: isCommitted,
      leaderId: leader.nodeId,
      term: leader.currentTerm,
      logIndex: entry.index,
      replicatedCount,
    };
  }

  /**
   * Advance cluster tick (periodic maintenance, sync heartbeats).
   */
  tick(): void {
    if (this._leaderId) {
      this.syncHeartbeats();
    }
  }

  /**
   * Return high-level status of the entire cluster.
   */
  getClusterStatus(): RaftClusterStatus {
    const nodes = Array.from(this._nodes.values()).map((n) => n.getStatus());
    const leaderNode = this._leaderId ? this._nodes.get(this._leaderId) : null;
    const currentTerm = leaderNode ? leaderNode.currentTerm : Math.max(0, ...nodes.map((n) => n.currentTerm));

    return deepFreeze({
      clusterId: this.clusterId,
      leaderId: this._leaderId,
      currentTerm,
      quorumSize: this.quorumSize,
      nodeCount: this.nodeCount,
      isQuorumFormed: this._leaderId !== null,
      nodes: deepFreeze(nodes),
      partitionGroups: deepFreeze(this._partitionGroups.map((g) => [...g])),
    });
  }

  /**
   * Generate an immutable SHA-256 cryptographic receipt of cluster consensus state.
   */
  generateReceipt(nonce = "receipt-nonce-01"): RaftClusterReceipt {
    const status = this.getClusterStatus();
    const leader = this._leaderId ? this._nodes.get(this._leaderId) : null;
    const fsmState = leader ? (leader.fsmState as Record<string, unknown>) : {};
    const fsmStateHash = computeFsmHash(fsmState);

    const logHashes: string[] = [];
    if (leader) {
      for (let i = 1; i <= leader.getLastLogIndex(); i++) {
        const e = leader.getLogEntry(i);
        if (e) logHashes.push(e.entryHash);
      }
    }
    const logRootHash = pureSha256(JSON.stringify(logHashes));

    const receiptPayload = {
      clusterId: this.clusterId,
      currentTerm: status.currentTerm,
      leaderId: status.leaderId,
      commitIndex: leader ? leader.commitIndex : 0,
      activeQuorum: status.isQuorumFormed,
      nodeCount: status.nodeCount,
      fsmStateHash,
      logRootHash,
      nonce,
    };

    const sha256Receipt = pureSha256(JSON.stringify(receiptPayload));

    const receipt: RaftClusterReceipt = {
      ...receiptPayload,
      sha256Receipt,
      generatedAt: new Date().toISOString(),
    };

    assertPostcondition(receipt.sha256Receipt.length === 64, "Receipt hash must be valid 64-char SHA-256");
    return deepFreeze(receipt);
  }
}
