/**
 * EOS Layer-0 Zero-Knowledge R1CS & QAP Arithmetic Circuit Core Types (SPEC-214)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 */

export const DEFAULT_ZK_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type ZkOperationType = "synthesize" | "prove" | "verify";

export interface R1csConstraint {
  readonly a: readonly bigint[];
  readonly b: readonly bigint[];
  readonly c: readonly bigint[];
}

export interface R1csSystem {
  readonly prime: bigint;
  readonly numVariables: number;
  readonly numConstraints: number;
  readonly publicInputCount: number;
  readonly variableNames: readonly string[];
  readonly constraints: readonly R1csConstraint[];
}

export interface WitnessAssignment {
  readonly values: readonly bigint[];
  readonly witnessCommitment: string;
}

export interface QapPolynomials {
  readonly aPoly: readonly bigint[];
  readonly bPoly: readonly bigint[];
  readonly cPoly: readonly bigint[];
  readonly targetPoly: readonly bigint[];
  readonly quotientPoly: readonly bigint[];
  readonly remainderPoly: readonly bigint[];
}

export interface ZkProof {
  readonly tau: bigint;
  readonly aTau: bigint;
  readonly bTau: bigint;
  readonly cTau: bigint;
  readonly hTau: bigint;
  readonly tTau: bigint;
  readonly proofDigest: string;
}

export interface ZkReceipt {
  readonly receiptId: string;
  readonly operation: ZkOperationType;
  readonly timestamp: string;
  readonly circuitDigest: string;
  readonly outputDigest: string;
  readonly receiptSha256: string;
}

export interface ZkVerificationResult {
  readonly valid: boolean;
  readonly verificationTimeMs: number;
  readonly receipt: ZkReceipt;
}
