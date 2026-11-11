/**
 * EosRaftConsensusEngine.types — Protocol Interfaces, Types and Pure State Reducers
 * Governed by SPEC-206, CHANGE-091, ADR-091 (v76.0.0)
 *
 * Strictly ZERO external runtime dependencies. Node 24 strip-only compliant.
 */

import { pureSha256 } from "./eosKernelPrimitives.ts";

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

export function defaultFsmReducer(state: Record<string, unknown>, command: unknown): Record<string, unknown> {
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

export function computeLogEntryHash(term: number, index: number, command: unknown): string {
  return pureSha256(JSON.stringify({ term, index, command }));
}

export function computeFsmHash(state: Record<string, unknown>): string {
  const sortedKeys = Object.keys(state).sort();
  const canonical: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    canonical[k] = state[k];
  }
  return pureSha256(JSON.stringify(canonical));
}
