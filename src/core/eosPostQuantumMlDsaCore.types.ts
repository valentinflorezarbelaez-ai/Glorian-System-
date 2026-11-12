/**
 * Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65) Type Definitions
 * Specification: SPEC-227 / CHANGE-112
 */

export interface MlDsaParameters {
  readonly name: "ML-DSA-65";
  readonly q: number; // 8380417
  readonly n: number; // 256
  readonly d: number; // 13
  readonly k: number; // 6 rows
  readonly l: number; // 5 cols
  readonly eta: number; // 4
  readonly gamma1: number; // 2^19 = 524288
  readonly gamma2: number; // (q - 1) / 32 = 261888
  readonly tau: number; // 49
  readonly beta: number; // 196
  readonly omega: number; // 55
  readonly pkBytes: number; // 1952
  readonly skBytes: number; // 4032
  readonly sigBytes: number; // 3309
}

export interface MlDsaPublicKey {
  readonly verificationKeyHex: string;
  readonly rhoHex: string;
  readonly t1Hex: string;
  readonly algorithm: "ML-DSA-65";
}

export interface MlDsaPrivateKey {
  readonly signingKeyHex: string;
  readonly rhoHex: string;
  readonly kHex: string;
  readonly trHex: string;
  readonly algorithm: "ML-DSA-65";
}

export interface MlDsaKeyPair {
  readonly publicKey: MlDsaPublicKey;
  readonly privateKey: MlDsaPrivateKey;
}

export interface MlDsaSignature {
  readonly signatureHex: string;
  readonly cTildeHex: string;
  readonly algorithm: "ML-DSA-65";
}

export interface MlDsaSignatureResult {
  readonly verified: boolean;
  readonly algorithm: "ML-DSA-65";
  readonly messageSha256: string;
  readonly receiptSha256: string;
}

export interface HybridMlDsaKeyPair {
  readonly ed25519PublicKeyPem: string;
  readonly ed25519PrivateKeyPem: string;
  readonly mlDsaKeyPair: MlDsaKeyPair;
}

export interface HybridMlDsaSignature {
  readonly ed25519SignatureHex: string;
  readonly mlDsaSignature: MlDsaSignature;
  readonly algorithm: "HYBRID-ED25519-ML-DSA-65";
  readonly receiptSha256: string;
}
