/**
 * EOS Layer-0 Conflict-Free Replicated Data Types (CRDT) Core Types (SPEC-215)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 */

export type VectorOrdering = "LESS" | "GREATER" | "EQUAL" | "CONCURRENT";
export type CrdtOperationType = "mutate" | "merge" | "delta";

export interface LwwRegister<T = unknown> {
  readonly value: T;
  readonly timestamp: number;
  readonly nodeId: string;
}

export interface OrSetElement<T = unknown> {
  readonly element: T;
  readonly tag: string;
  readonly timestamp: number;
  readonly nodeId: string;
}

export interface OrSetSnapshot<T = unknown> {
  readonly adds: readonly OrSetElement<T>[];
  readonly removes: readonly string[];
}

export interface RgaNode<T = unknown> {
  readonly id: string;
  readonly parentId: string | null;
  readonly value: T;
  readonly deleted: boolean;
  readonly timestamp: number;
  readonly nodeId: string;
}

export interface CrdtStateSnapshot {
  readonly nodeId: string;
  readonly vectorClock: Record<string, number>;
  readonly registers: Record<string, LwwRegister>;
  readonly sets: Record<string, OrSetSnapshot>;
  readonly sequences: Record<string, readonly RgaNode[]>;
  readonly stateHashSha256: string;
}

export interface CrdtDelta {
  readonly sourceNodeId: string;
  readonly vectorClock: Record<string, number>;
  readonly registers: Record<string, LwwRegister>;
  readonly sets: Record<string, OrSetSnapshot>;
  readonly sequences: Record<string, readonly RgaNode[]>;
}

export interface CrdtReceipt {
  readonly receiptId: string;
  readonly operation: CrdtOperationType;
  readonly timestamp: string;
  readonly stateHashSha256: string;
  readonly receiptSha256: string;
}

export interface CrdtMergeResult {
  readonly converged: boolean;
  readonly stateHashSha256: string;
  readonly vectorClock: Record<string, number>;
  readonly receipt: CrdtReceipt;
}
