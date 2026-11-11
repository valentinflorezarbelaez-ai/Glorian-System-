/**
 * EOS Layer-0 Sparse Merkle Tree (SMT) Core Types (SPEC-218)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 */

export type SmtNodeType = "empty" | "leaf" | "branch";

export type SmtProofType = "membership" | "non_membership";

export type SmtOperationType = "set" | "delete" | "prove" | "verify";

export interface SmtSibling {
  readonly depth: number;
  readonly isRight: boolean;
  readonly hash: string;
}

export interface SmtProof {
  readonly proofType: SmtProofType;
  readonly key: string;
  readonly keyPath: string;
  readonly value: string | null;
  readonly valueHash: string;
  readonly nonMembershipReason?: "EMPTY_SUBTREE" | "KEY_COLLISION";
  readonly conflictingKey?: string;
  readonly conflictingValueHash?: string;
  readonly siblings: readonly SmtSibling[];
  readonly root: string;
}

export interface SmtReceipt {
  readonly receiptId: string;
  readonly operation: SmtOperationType;
  readonly timestamp: string;
  readonly root: string;
  readonly receiptSha256: string;
}

export interface SmtVerificationResult {
  readonly valid: boolean;
  readonly proofType: SmtProofType;
  readonly verificationTimeMs: number;
  readonly receipt: SmtReceipt;
}

export interface SmtSnapshot {
  readonly leafCount: number;
  readonly root: string;
}
