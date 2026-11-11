/**
 * EosPbftConsensusEngine.types — Protocol Types, State Reducers, and Certificates
 * Governed by SPEC-210, CHANGE-095, ADR-095, FR-1069..FR-1073 (v76.0.0)
 *
 * Strictly ZERO external runtime dependencies. Node 24 strip-only compliant.
 */

import { pureSha256 } from "./eosKernelPrimitives.ts";

export type PbftPhase = "PRE-PREPARE" | "PREPARE" | "COMMIT" | "COMMITTED" | "VIEW-CHANGE" | "NEW-VIEW";

export interface PbftMessage {
  readonly type: PbftPhase;
  readonly view: number;
  readonly sequenceNumber: number;
  readonly digest: string;
  readonly sender: string;
  readonly proposal?: unknown;
  readonly signature: string;
  readonly extraEvidence?: unknown;
}

export interface PreparedCertificate {
  readonly view: number;
  readonly sequenceNumber: number;
  readonly digest: string;
  readonly prePrepare: PbftMessage;
  readonly prepares: readonly PbftMessage[];
}

export interface CommittedCertificate {
  readonly view: number;
  readonly sequenceNumber: number;
  readonly digest: string;
  readonly commits: readonly PbftMessage[];
}

export interface ViewChangeCertificate {
  readonly view: number;
  readonly viewChanges: readonly PbftMessage[];
}

export interface ByzantineSlashingReceipt {
  readonly receiptId: string;
  readonly slashedNodeId: string;
  readonly view: number;
  readonly sequenceNumber: number;
  readonly evidenceType: "EQUIVOCATION_DETECTED" | "FORGED_DIGEST" | "UNCONSTITUTIONAL_MUTATION";
  readonly digestA: string;
  readonly digestB: string;
  readonly senderSignatureA: string;
  readonly senderSignatureB: string;
  readonly sha256Receipt: string;
  readonly timestamp: string;
}

export interface PbftNodeStatus {
  readonly nodeId: string;
  readonly isPrimary: boolean;
  readonly currentView: number;
  readonly sequenceNumber: number;
  readonly f: number;
  readonly quorum: number;
  readonly isQuarantined: boolean;
  readonly lastCommittedSeq: number;
  readonly fsmState: Readonly<Record<string, unknown>>;
}

export interface PbftClusterStatus {
  readonly clusterId: string;
  readonly totalNodes: number;
  readonly f: number;
  readonly quorumSize: number;
  readonly primaryNodeId: string;
  readonly currentView: number;
  readonly activeQuorum: boolean;
  readonly quarantinedNodes: readonly string[];
  readonly nodes: readonly PbftNodeStatus[];
  readonly lastCommitSequence: number;
  readonly fsmStateHash: string;
}

export interface PbftExecutionReceipt {
  readonly clusterId: string;
  readonly view: number;
  readonly sequenceNumber: number;
  readonly digest: string;
  readonly output: unknown;
  readonly fsmStateHash: string;
  readonly committedCertificate: CommittedCertificate;
  readonly sha256Receipt: string;
  readonly timestamp: string;
}

export type PbftFsmReducer = (state: Record<string, unknown>, command: unknown) => Record<string, unknown>;
export type FsmReducer = PbftFsmReducer;

export function computeMessageDigest(proposal: unknown): string {
  const serialized =
    typeof proposal === "object" && proposal !== null
      ? JSON.stringify(proposal, Object.keys(proposal).sort())
      : String(proposal);
  return pureSha256(serialized);
}

export function computePbftFsmHash(state: Record<string, unknown>): string {
  const sortedKeys = Object.keys(state).sort();
  const canonical: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    canonical[k] = state[k];
  }
  return pureSha256(JSON.stringify(canonical));
}
export const computeFsmHash = computePbftFsmHash;

export function defaultPbftFsmReducer(state: Record<string, unknown>, command: unknown): Record<string, unknown> {
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
export const defaultFsmReducer = defaultPbftFsmReducer;

export function signPbftPayload(
  sender: string,
  type: PbftPhase,
  view: number,
  sequenceNumber: number,
  digest: string,
): string {
  return pureSha256(`${sender}:${type}:${view}:${sequenceNumber}:${digest}`);
}
