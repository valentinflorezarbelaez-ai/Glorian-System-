/**
 * EOS Layer-0 FROST Threshold Schnorr Signatures (RFC 9591) Types (SPEC-219)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 */

import { type AffinePoint } from "./eosVerifiableRandomFunctionCore.types.ts";

export type FrostOperationType = "keygen" | "sign" | "verify";

export interface FrostKeyShare {
  readonly participantId: number;
  readonly secretShare: bigint;
  readonly secretShareHex: string;
  readonly verificationKey: AffinePoint;
  readonly verificationKeyHex: string;
}

export interface FrostGroupKey {
  readonly threshold: number;
  readonly totalSigners: number;
  readonly groupPublicKey: AffinePoint;
  readonly groupPublicKeyHex: string;
  readonly participantVerificationKeys: readonly {
    readonly participantId: number;
    readonly publicKeyHex: string;
  }[];
}

export interface FrostNoncePair {
  readonly participantId: number;
  readonly hidingNonce: bigint;
  readonly bindingNonce: bigint;
  readonly hidingCommitment: AffinePoint;
  readonly bindingCommitment: AffinePoint;
  readonly hidingCommitmentHex: string;
  readonly bindingCommitmentHex: string;
}

export interface FrostCommitmentShare {
  readonly participantId: number;
  readonly hidingCommitmentHex: string;
  readonly bindingCommitmentHex: string;
}

export interface FrostSignatureShare {
  readonly participantId: number;
  readonly responseScalar: bigint;
  readonly responseScalarHex: string;
}

export interface FrostSignature {
  readonly rHex: string;
  readonly zHex: string;
  readonly rPoint: AffinePoint;
  readonly z: bigint;
}

export interface FrostReceipt {
  readonly receiptId: string;
  readonly operation: FrostOperationType;
  readonly timestamp: string;
  readonly digest: string;
  readonly receiptSha256: string;
}

export interface FrostSigningResult {
  readonly signature: FrostSignature;
  readonly signatureHex: string;
  readonly groupPublicKeyHex: string;
  readonly message: string;
  readonly receipt: FrostReceipt;
}

export interface FrostVerificationResult {
  readonly valid: boolean;
  readonly verificationTimeMs: number;
  readonly receipt: FrostReceipt;
}
