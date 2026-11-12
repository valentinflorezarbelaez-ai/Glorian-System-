/**
 * EOS Layer-0 KZG Polynomial Commitments & Multi-Proof Core Types (SPEC-220)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 * Enforces IEEE 830 EARS FR-1119..FR-1123 and ISO/IEC/IEEE 29148 BDD-1119..BDD-1123.
 */

import { type AffinePoint } from "./eosVerifiableRandomFunctionCore.types.ts";

export type KzgOperationType = "setup" | "commit" | "open" | "verify" | "open_batch" | "verify_batch";

export interface KzgReceipt {
  readonly receiptId: string;
  readonly operation: KzgOperationType;
  readonly timestamp: string;
  readonly digest: string;
  readonly receiptSha256: string;
}

export interface KzgSrs {
  readonly maxDegree: number;
  readonly srs1: readonly AffinePoint[];
  readonly srs1Hex: readonly string[];
  readonly toxicWasteDigest: string;
}

export interface KzgCommitment {
  readonly commitmentPoint: AffinePoint;
  readonly commitmentHex: string;
  readonly degree: number;
  readonly receipt: KzgReceipt;
}

export interface KzgOpeningProof {
  readonly proofPoint: AffinePoint;
  readonly proofHex: string;
  readonly evaluationPoint: bigint;
  readonly evaluationPointHex: string;
  readonly claimedValue: bigint;
  readonly claimedValueHex: string;
  readonly quotientDegree: number;
  readonly receipt: KzgReceipt;
}

export interface KzgBatchProof {
  readonly proofPoint: AffinePoint;
  readonly proofHex: string;
  readonly evaluationPoints: readonly bigint[];
  readonly claimedValues: readonly bigint[];
  readonly receipt: KzgReceipt;
}

export interface KzgVerificationResult {
  readonly valid: boolean;
  readonly verificationTimeMs: number;
  readonly receipt: KzgReceipt;
}
