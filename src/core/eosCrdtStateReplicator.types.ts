/**
 * Glorian System — Decentralized Cross-Fleet Merkle-CRDT State Replication Protocol Types
 * Governed by SPEC-308 / CHANGE-170 / ADR-170
 *
 * Formal contracts for content-addressed Merkle-DAG nodes, join-semilattices,
 * linear memory vector convergence, and anti-entropy synchronization.
 *
 * Strict Zero Runtime Dependencies (Law V).
 */

export type CrdtPrimitiveType = "LWW_REGISTER" | "PN_COUNTER" | "OR_SET" | "VECTOR_STATE";

/**
 * Last-Write-Wins Register State with deterministic tie-breaking.
 */
export interface LwwRegisterState<T = unknown> {
  value: T;
  lamport: number;
  actor: string;
  timestamp: number;
}

/**
 * Positive-Negative Distributed Counter State.
 */
export interface PnCounterState {
  pos: Record<string, number>;
  neg: Record<string, number>;
  value: number;
}

/**
 * Observed-Remove Set Element with unique addition tag.
 */
export interface CrdtOrSetElement<T = unknown> {
  tag: string;
  value: T;
  actor: string;
  lamport: number;
}

/**
 * Observed-Remove Set State.
 */
export interface OrSetState<T = unknown> {
  entries: Record<string, CrdtOrSetElement<T>>;
  tombstones: Record<string, boolean>;
  elements: T[];
}

/**
 * Immutable content-addressed Merkle-DAG node.
 */
export interface MerkleCrdtNode {
  cid: string;
  parents: string[];
  actor: string;
  lamport: number;
  type: CrdtPrimitiveType;
  key: string;
  delta: unknown;
  timestamp: number;
  signature?: string;
}

/**
 * High-performance linear memory vector merge performance metrics.
 */
export interface LinearMemoryVectorMergeResult {
  dimension: number;
  mergedElements: number[];
  operationsCount: number;
  durationNs: number;
  memoryBytesUsed: number;
}

/**
 * Anti-entropy logarithmic sync session report.
 */
export interface AntiEntropySyncResult {
  inSync: boolean;
  localRoot: string;
  remoteRoot: string;
  divergentNodesCount: number;
  syncedNodeCids: string[];
  durationMs: number;
}

/**
 * Cross-fleet replication project status snapshot.
 */
export interface FleetProjectReplicationStatus {
  projectId: string;
  merkleRoot: string;
  nodeCount: number;
  lamportHead: number;
  inSyncWithMesh: boolean;
}

/**
 * Formal verification and audit receipt for SPEC-308.
 */
export interface CrdtReplicationReceipt {
  timestampIso: string;
  specRef: string;
  changeRef: string;
  status: "CRDT_CONVERGENCE_VERIFIED" | "CRDT_CONVERGENCE_DRIFT_DETECTED";
  fleetProjectsAudited: number;
  projects: FleetProjectReplicationStatus[];
  semilatticePropertiesVerified: {
    associativity: boolean;
    commutativity: boolean;
    idempotency: boolean;
  };
  linearMemoryBenchmarkNsPerOp: number;
  cryptographicSignature: string;
}
