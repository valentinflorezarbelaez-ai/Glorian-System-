/**
 * EOS Layer-0 Verifiable Random Functions (ECVRF RFC 9381) Core Types (SPEC-217)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 */

export interface AffinePoint {
  readonly x: bigint;
  readonly y: bigint;
}

export type SecpPoint = AffinePoint | null;

export interface VrfKeyPair {
  readonly secretKey: bigint;
  readonly secretKeyHex: string;
  readonly publicKey: AffinePoint;
  readonly publicKeyHex: string;
}

export interface VrfProof {
  readonly gamma: AffinePoint;
  readonly gammaHex: string;
  readonly c: bigint;
  readonly cHex: string;
  readonly s: bigint;
  readonly sHex: string;
}

export type VrfOperationType = "evaluate" | "verify" | "elect";

export interface VrfReceipt {
  readonly receiptId: string;
  readonly operation: VrfOperationType;
  readonly timestamp: string;
  readonly digest: string;
  readonly receiptSha256: string;
}

export interface VrfEvaluationResult {
  readonly beta: string;
  readonly proof: VrfProof;
  readonly receipt: VrfReceipt;
}

export interface VrfVerificationResult {
  readonly valid: boolean;
  readonly beta: string;
  readonly verificationTimeMs: number;
  readonly receipt: VrfReceipt;
}

export interface VrfElectionResult {
  readonly isElected: boolean;
  readonly score: number;
  readonly threshold: number;
  readonly beta: string;
  readonly receipt: VrfReceipt;
}
