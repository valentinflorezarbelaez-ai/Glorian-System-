/**
 * EOS Layer-0 Bulletproofs NIZK Range Proofs Core Types (SPEC-222)
 * Zero-Knowledge Range Proofs without Trusted Setup (Bünz et al.)
 * Strict Zero Runtime Dependencies (EOS Law I & V), Node 24 Strip-Only TypeScript.
 */

import type { AffinePoint } from "./eosVerifiableRandomFunctionCore.types.ts";

export type { AffinePoint };

export interface BulletproofsGenerators {
  readonly bitLength: number;
  readonly g: readonly AffinePoint[];
  readonly h: readonly AffinePoint[];
  readonly H: AffinePoint;
  readonly U: AffinePoint;
}

export interface BulletproofsCommitment {
  readonly value: bigint;
  readonly gamma: bigint;
  readonly point: AffinePoint;
  readonly pointHex: string;
}

export interface InnerProductProof {
  readonly L: readonly AffinePoint[];
  readonly R: readonly AffinePoint[];
  readonly a: bigint;
  readonly b: bigint;
}

export interface BulletproofsRangeProof {
  readonly commitment: AffinePoint;
  readonly commitmentHex: string;
  readonly bitLength: number;
  readonly A: AffinePoint;
  readonly S: AffinePoint;
  readonly T1: AffinePoint;
  readonly T2: AffinePoint;
  readonly tauX: bigint;
  readonly mu: bigint;
  readonly tHat: bigint;
  readonly ipProof: InnerProductProof;
  readonly proofSha256: string;
}

export interface BulletproofsVerificationResult {
  readonly valid: boolean;
  readonly bitLength: number;
  readonly verificationTimeMs: number;
  readonly reason?: string;
  readonly receipt: BulletproofsReceipt;
}

export type BulletproofsOperationType = "commit" | "prove" | "verify" | "benchmark";

export interface BulletproofsReceipt {
  readonly receiptId: string;
  readonly operation: BulletproofsOperationType;
  readonly bitLength: number;
  readonly timestamp: string;
  readonly digest: string;
  readonly receiptSha256: string;
}

export interface BulletproofsBenchmarkResult {
  readonly bitLength: number;
  readonly iterations: number;
  readonly commitOpsPerSec: number;
  readonly proveOpsPerSec: number;
  readonly verifyOpsPerSec: number;
  readonly averageProveTimeMs: number;
  readonly averageVerifyTimeMs: number;
  readonly receipt: BulletproofsReceipt;
}
