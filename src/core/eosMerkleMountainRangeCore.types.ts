/**
 * EOS Layer-0 Merkle Mountain Range (MMR) Core Types (SPEC-216)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 */

export type MmrOperationType = "append" | "prove" | "verify";

export interface MmrNode {
  readonly pos: number;
  readonly height: number;
  readonly hash: string;
  readonly leafIndex?: number;
}

export interface MmrPeak {
  readonly pos: number;
  readonly height: number;
  readonly hash: string;
}

export interface MmrInclusionProof {
  readonly leafIndex: number;
  readonly leafPos: number;
  readonly leafHash: string;
  readonly mmrSize: number;
  readonly siblings: readonly { readonly pos: number; readonly height: number; readonly hash: string }[];
  readonly peaks: readonly MmrPeak[];
  readonly root: string;
}

export interface MmrConsistencyProof {
  readonly fromSize: number;
  readonly toSize: number;
  readonly fromRoot: string;
  readonly toRoot: string;
  readonly proofHashes: readonly string[];
}

export interface MmrSnapshot {
  readonly leafCount: number;
  readonly mmrSize: number;
  readonly root: string;
  readonly peaks: readonly MmrPeak[];
}

export interface MmrReceipt {
  readonly receiptId: string;
  readonly operation: MmrOperationType;
  readonly timestamp: string;
  readonly root: string;
  readonly receiptSha256: string;
}

export interface MmrVerificationResult {
  readonly valid: boolean;
  readonly verificationTimeMs: number;
  readonly receipt: MmrReceipt;
}
