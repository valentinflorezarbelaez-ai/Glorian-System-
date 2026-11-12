/**
 * EOS Layer-0 Secure Multi-Party Computation Engine — Type Definitions
 *
 * SPEC-212 / CHANGE-097 / Shamir's Secret Sharing & Beaver Multiplicative Triples
 * Strictly zero external dependencies. Pure Node 24 strip-only TypeScript.
 */

export interface MpcFieldParameters {
  readonly prime: bigint;
  readonly threshold: number; // k: Minimum shares required to reconstruct secret
  readonly totalParties: number; // N: Total number of distributed shares generated
}

export interface SecretShare {
  readonly x: bigint;
  readonly y: bigint;
  readonly commitment: string; // SHA-256 commitment of (x:y:prime)
}

export interface BeaverTriple {
  readonly tripleId: string;
  readonly a: bigint;
  readonly b: bigint;
  readonly c: bigint;
  readonly sharesA: readonly SecretShare[];
  readonly sharesB: readonly SecretShare[];
  readonly sharesC: readonly SecretShare[];
  readonly createdAt: string;
}

export type MpcOperationType = "split" | "combine" | "add" | "sub" | "scale" | "multiply";

export interface MpcReceipt {
  readonly receiptId: string;
  readonly operation: MpcOperationType;
  readonly timestamp: string;
  readonly inputsDigest: string;
  readonly outputDigest: string;
  readonly receiptSha256: string;
}

export interface ReconstructionResult {
  readonly secret: bigint;
  readonly sharesUsed: number;
  readonly receipt: MpcReceipt;
}

export const DEFAULT_MPC_PRIME: bigint = 2147483647n; // 2^31 - 1 (Mersenne prime)
export const DEFAULT_MPC_THRESHOLD: number = 3;
export const DEFAULT_MPC_PARTIES: number = 5;
