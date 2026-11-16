/**
 * Conflict-Free P2P Mesh Synchronization with Automerge Wasm Types
 *
 * SPEC-300 / CHANGE-162 (Phase 4.1)
 * Strict Zero Runtime Dependencies (Law V)
 */

export type CrdtOpAction = "SET" | "DEL" | "INC" | "APPEND_TEXT";

export interface CrdtOp {
  action: CrdtOpAction;
  key: string;
  value: unknown;
  lamport: number;
  actor: string;
}

export interface CrdtChange {
  hash: string;
  actor: string;
  seq: number;
  deps: string[];
  lamport: number;
  timestamp: number;
  ops: CrdtOp[];
}

export interface CrdtDocumentState {
  docId: string;
  actorId: string;
  heads: string[];
  lamport: number;
  data: Record<string, unknown>;
}

export interface CrdtSyncMessage {
  docId: string;
  senderActor: string;
  heads: string[];
  changes: CrdtChange[];
}

export interface DtnPacket {
  packetId: string;
  targetPeer: string;
  syncMessage: CrdtSyncMessage;
  enqueuedAt: number;
  delivered: boolean;
}

export interface AutomergeCrdtReceipt {
  timestampIso: string;
  specRef: string;
  totalPeersTested: number;
  changesApplied: number;
  convergenceVerified: boolean;
  dtnPacketsDelivered: number;
  sha256Signature: string;
}
