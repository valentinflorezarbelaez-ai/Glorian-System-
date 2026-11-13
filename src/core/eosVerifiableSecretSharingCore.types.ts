/**
 * @file eosVerifiableSecretSharingCore.types.ts
 * @module EosVerifiableSecretSharingCore/Types
 * @description Type definitions for Layer-0 Verifiable Secret Sharing (Feldman & Pedersen VSS).
 * SPEC-233 / CHANGE-118
 */

export type VssScheme = "feldman" | "pedersen";

export interface VssShare {
  /** 1-based participant identifier */
  id: number;
  /** Share evaluation value f(i) mod q in hex */
  valueHex: string;
  /** Blinding polynomial evaluation g(i) mod q in hex (Pedersen VSS only) */
  blindingHex?: string;
}

export interface VssCommitmentPackage {
  scheme: VssScheme;
  k: number;
  n: number;
  /** Public coefficient commitments in hex */
  commitmentsHex: string[];
  /** Group generator g in hex */
  generatorGHex: string;
  /** Secondary generator h in hex (Pedersen VSS only) */
  generatorHHex?: string;
  /** Safe prime modulus p in hex */
  primePHex: string;
  /** Subgroup prime order q in hex */
  orderQHex: string;
}

export interface VssDeal {
  scheme: VssScheme;
  k: number;
  n: number;
  shares: VssShare[];
  commitments: VssCommitmentPackage;
}

export interface VssVerificationResult {
  valid: boolean;
  participantId: number;
  reason?: string;
}

export interface VssReconstructionResult {
  secretHex: string;
  secretString?: string;
  cheatersIdentified: number[];
  validShareCount: number;
}
