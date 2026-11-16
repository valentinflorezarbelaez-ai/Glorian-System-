/**
 * GLORIAN SYSTEM — CONFIDENTIAL ENCLAVE TEE GOVERNOR TYPES
 *
 * Formal contracts for Hardware TEEs (AWS Nitro, AMD SEV-SNP, Intel SGX/TDX),
 * Platform Configuration Register (PCR) measurements, remote attestation,
 * hardware-bound secret sealing, and tamper guards.
 *
 * Governed by SPEC-301 (FR-301-01..FR-301-06, BDD-1581..BDD-1586).
 * Strict Law V: Zero third-party runtime dependencies.
 */

export interface EnclaveDefinition {
  readonly enclaveId: string;
  readonly imageBinaryOrPath: string | Uint8Array;
  readonly bootArgs: string;
  readonly applicationBundle: string | Uint8Array;
  readonly iamRoleArnOrContext?: string;
}

export interface EnclavePcrRegisters {
  readonly pcr0: string; // SHA-256 of image/kernel
  readonly pcr1: string; // SHA-256 of boot args
  readonly pcr2: string; // SHA-256 of application code bundle
  readonly pcr8: string; // SHA-256 of IAM/security context
}

export interface EnclaveAttestationDocument {
  readonly version: string;
  readonly enclaveId: string;
  readonly timestampIso: string;
  readonly nonce: string;
  readonly pcrs: EnclavePcrRegisters;
  readonly enclavePublicKeyPem: string;
  readonly rootOfTrustPublicKeyPem: string;
  readonly signatureHex: string;
}

export type EnclaveAttestationVerdict =
  "ATTESTATION_VERIFIED" | "SIGNATURE_INVALID" | "NONCE_REPLAY_DETECTED" | "PCR_MEASUREMENT_MISMATCH";

export interface EnclaveVerificationResult {
  readonly valid: boolean;
  readonly verdict: EnclaveAttestationVerdict;
  readonly enclaveId: string;
  readonly signatureVerified: boolean;
  readonly nonceVerified: boolean;
  readonly pcrMatches: boolean;
  readonly driftDetails?: Readonly<Record<string, { readonly expected: string; readonly actual: string }>>;
}

export interface SealedPayload {
  readonly algorithm: "AES-256-GCM";
  readonly keyDerivation: "HKDF-SHA256";
  readonly ivHex: string;
  readonly authTagHex: string;
  readonly ciphertextHex: string;
  readonly boundPcrs: {
    readonly pcr0: string;
    readonly pcr2: string;
  };
  readonly saltHex: string;
}

export interface EnclaveAuditReceipt {
  readonly timestampIso: string;
  readonly specRef: "SPEC-301";
  readonly totalEnclavesAudited: number;
  readonly attestationValid: boolean;
  readonly sealingVerified: boolean;
  readonly pcrIntegrityGuarded: boolean;
  readonly sha256Signature: string;
}
