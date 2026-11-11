/**
 * EOS Layer-0 Lattice-Based Homomorphic Encryption Core — Type Definitions
 *
 * SPEC-211 / CHANGE-096 / Ring Learning with Errors (RLWE) BFV-style SHE
 * Strictly zero external dependencies. Pure Node 24 strip-only TypeScript.
 */

export interface HomomorphicParameters {
  readonly polyDegree: number; // N: Degree of cyclotomic polynomial X^N + 1 (power of two >= 16)
  readonly ciphertextModulus: number; // q: Integer/prime modulus (q > t)
  readonly plaintextModulus: number; // t: Plaintext modulus (t >= 2)
  readonly errorBound: number; // \beta: Maximum error magnitude (default: 2)
}

export interface LatticeSecretKey {
  readonly s: readonly number[];
  readonly params: HomomorphicParameters;
  readonly keyFingerprint: string;
}

export interface LatticePublicKey {
  readonly pk0: readonly number[];
  readonly pk1: readonly number[];
  readonly params: HomomorphicParameters;
  readonly keyFingerprint: string;
}

export interface LatticeKeypair {
  readonly publicKey: LatticePublicKey;
  readonly secretKey: LatticeSecretKey;
  readonly createdAt: string;
}

export interface Ciphertext {
  readonly c0: readonly number[];
  readonly c1: readonly number[];
  readonly params: HomomorphicParameters;
  readonly scaleDelta: number;
  readonly noiseBudgetBits: number;
  readonly ciphertextDigest: string;
}

export type HomomorphicOperationType = "keygen" | "encrypt" | "add" | "sub" | "scalar_multiply" | "decrypt";

export interface HomomorphicReceipt {
  readonly receiptId: string;
  readonly operation: HomomorphicOperationType;
  readonly timestamp: string;
  readonly inputsDigest: string;
  readonly outputDigest: string;
  readonly noiseBudgetBits?: number;
  readonly receiptSha256: string;
}

export interface DecryptionResult {
  readonly plaintext: readonly number[];
  readonly noiseBudgetBits: number;
  readonly receipt: HomomorphicReceipt;
}

export const DEFAULT_HOMOMORPHIC_PARAMS: HomomorphicParameters = Object.freeze({
  polyDegree: 32,
  ciphertextModulus: 65537,
  plaintextModulus: 257,
  errorBound: 2,
});
