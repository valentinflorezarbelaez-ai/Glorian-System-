/**
 * Glorian System — Threshold Secret Sharing & Ring-LWE Homomorphic Secure Aggregation (PQ-MPC)
 * Governed by SPEC-335 / CHANGE-197 / ADR-197-001..003
 *
 * Reference implementation only: default parameters are NOT secure.
 */

/** Polynomial in R_q = Z_q[x]/(x^n + 1), coefficients in [0, q). */
export type PqmpcPolynomial = bigint[];

export interface PqmpcConfig {
  /** Ring degree n (power of two, 8..4096). Default 64. */
  ringDegree?: number;
  /** Plaintext modulus t (2..2^20). Default 65537. */
  plaintextModulus?: bigint;
  /** Number of key-share custodians N (2..64). Default 5. */
  parties?: number;
  /** Decryption threshold T (2..N). Default 3. */
  threshold?: number;
  /** Optional seed for deterministic (test/audit) sampling. Omit for crypto randomness. */
  seed?: string | number | bigint;
}

export interface PqmpcParameters {
  ringDegree: number;
  ciphertextModulus: bigint;
  plaintextModulus: bigint;
  scalingFactor: bigint;
  parties: number;
  threshold: number;
  deterministic: boolean;
}

export interface PqmpcShamirShare {
  /** Abscissa x in 1..N. */
  x: bigint;
  /** Ordinate y = f(x) mod q. */
  y: bigint;
  /** SHA-256 hex commitment over (x, y). */
  commitment: string;
}

export interface PqmpcPublicKey {
  b: PqmpcPolynomial;
  a: PqmpcPolynomial;
}

export interface PqmpcKeyShare {
  partyId: string;
  x: bigint;
  /** Coefficient-wise Shamir share of the ring secret key. */
  secretShare: PqmpcPolynomial;
  /** SHA-256 hex commitment over (x, secretShare). */
  commitment: string;
}

export interface PqmpcThresholdKeySet {
  publicKey: PqmpcPublicKey;
  keyShares: PqmpcKeyShare[];
  /** Published commitments indexed by partyId, used to verify custodians. */
  publishedCommitments: Record<string, string>;
}

export interface PqmpcCiphertext {
  c0: PqmpcPolynomial;
  c1: PqmpcPolynomial;
  /** Number of meaningful plaintext slots. */
  slots: number;
  /** Number of homomorphic operations applied (diagnostic). */
  operations: number;
}

export interface PqmpcPartialDecryption {
  partyId: string;
  x: bigint;
  share: PqmpcPolynomial;
}

export interface PqmpcAggregationResult {
  sum: bigint[];
  contributors: number;
  decryptingParties: string[];
  aggregateDigest: string;
}

export interface PqmpcAuditReceipt {
  specRef: "SPEC-335";
  parameters: {
    ringDegree: number;
    ciphertextModulus: string;
    plaintextModulus: string;
    parties: number;
    threshold: number;
  };
  shamirRoundTrip: boolean;
  belowThresholdRejected: boolean;
  tamperDetected: boolean;
  encryptionRandomized: boolean;
  homomorphicAggregation: boolean;
  thresholdDecryption: boolean;
  allPassed: boolean;
  securityNotice: string;
  sha256Digest: string;
}

export type PqmpcErrorCode =
  | "PQMPC_INVALID_PARAMETERS"
  | "PQMPC_BELOW_THRESHOLD"
  | "PQMPC_DUPLICATE_SHARE"
  | "PQMPC_COMMITMENT_MISMATCH"
  | "PQMPC_PLAINTEXT_OUT_OF_RANGE"
  | "PQMPC_SLOT_OVERFLOW"
  | "PQMPC_SHAPE_MISMATCH";
