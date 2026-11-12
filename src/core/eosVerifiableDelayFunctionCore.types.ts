/**
 * EOS Layer-0 Verifiable Delay Function Engine — Type Definitions
 *
 * SPEC-213 / CHANGE-098 / Wesolowski VDF over RSA Composite Groups
 * Strictly zero external dependencies. Pure Node 24 strip-only TypeScript.
 */

export interface VdfParameters {
  readonly modulus: bigint; // N: RSA composite modulus (p * q)
  readonly defaultDelay: number; // T: Number of sequential squarings
  readonly challengeBits: number; // Bit size for prime challenge \ell (default: 64)
}

export interface WesolowskiProof {
  readonly pi: bigint; // \pi = x^{\lfloor 2^T / \ell \rfloor} mod N
  readonly challengePrime: bigint; // \ell: Fiat-Shamir prime challenge
  readonly proofHex: string;
}

export interface VdfEvaluationResult {
  readonly x: bigint;
  readonly y: bigint; // y = x^{2^T} mod N
  readonly delayT: number;
  readonly proof: WesolowskiProof;
  readonly randomnessBeacon: string; // SHA-256(y)
  readonly elapsedMs: number;
  readonly receipt: VdfReceipt;
}

export interface VdfVerificationResult {
  readonly valid: boolean;
  readonly verificationTimeMs: number;
  readonly receipt: VdfReceipt;
}

export type VdfOperationType = "compute" | "verify" | "beacon";

export interface VdfReceipt {
  readonly receiptId: string;
  readonly operation: VdfOperationType;
  readonly timestamp: string;
  readonly inputDigest: string;
  readonly outputDigest: string;
  readonly receiptSha256: string;
}

/**
 * Canonical 1024-bit composite RSA modulus with unknown discrete log factorization
 */
export const DEFAULT_VDF_MODULUS: bigint = BigInt(
  "0x" +
    "d0fc1f9594091d06a25c7c2c8c7b9419334c6b5534104b36d547ce7b3fbe874c" +
    "898edcc0e6f3617d726a02f8e0bc849956a4a8ff9c949fac07171026118d3dca" +
    "1c0550111fc492e212d78299718c47d07ff15ec777010933f853ec7fd7e26bff" +
    "2ca12eb812afad7082e519d6f9259553840e3fc865b9a2a692fed23a7c8b4279",
);

export const DEFAULT_VDF_DELAY: number = 200;
export const DEFAULT_CHALLENGE_BITS: number = 64;
