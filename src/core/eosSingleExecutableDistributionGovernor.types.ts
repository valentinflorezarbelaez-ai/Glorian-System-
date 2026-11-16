/**
 * GLORIAN SYSTEM — SINGLE EXECUTABLE APPLICATION DISTRIBUTION TYPES
 *
 * Formal contracts for target platform cross-matrices, SEA blob configuration,
 * dual Ed25519 and ML-DSA post-quantum code signing, and distribution bundles.
 *
 * Governed by SPEC-304 (FR-304-01..FR-304-06, BDD-1599..BDD-1604).
 * Strict Law V: Zero third-party runtime dependencies.
 */

export type TargetPlatform = "linux-x64" | "linux-arm64" | "darwin-arm64" | "darwin-x64" | "win32-x64";

export interface PlatformSpec {
  readonly platform: TargetPlatform;
  readonly os: "linux" | "darwin" | "win32";
  readonly arch: "x64" | "arm64";
  readonly executableExtension: string;
  readonly binaryName: string;
  readonly nodeSeaFuse: boolean;
  readonly supported: boolean;
}

export interface SeaDistributionConfig {
  readonly main: string;
  readonly output: string;
  readonly disableExperimentalSEAWarning: boolean;
  readonly useSnapshot: boolean;
  readonly useCodeCache: boolean;
}

export interface DualSignKeyPair {
  readonly publicKeyPem: string;
  readonly privateKeyPem: string;
  readonly pqcKeyId: string;
}

export interface DualSignature {
  readonly signatureHex: string;
  readonly pqcSignatureHex: string;
  readonly pqcAlgorithm: "ML-DSA-65";
  readonly timestampIso: string;
  readonly payloadSha256: string;
}

export interface BinaryVerificationResult {
  readonly valid: boolean;
  readonly digestSha256: string;
  readonly signatureVerified: boolean;
  readonly pqcVerified: boolean;
  readonly error?: string;
}

export interface DistributionBundle {
  readonly platform: TargetPlatform;
  readonly binaryName: string;
  readonly binarySize: number;
  readonly digestSha256: string;
  readonly signature: DualSignature;
  readonly inTotoStatement: Record<string, unknown>;
}

export interface SeaDistributionAuditReceipt {
  readonly receiptType: "EOS_SEA_BINARY_DISTRIBUTION_AUDIT";
  readonly timestampIso: string;
  readonly specRef: "SPEC-304";
  readonly totalPlatforms: number;
  readonly binariesVerified: number;
  readonly dualSigningVerified: boolean;
  readonly sha256Signature: string;
}
