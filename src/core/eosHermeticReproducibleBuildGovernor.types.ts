/**
 * GLORIAN SYSTEM — HERMETIC REPRODUCIBLE BUILD GOVERNOR TYPES
 *
 * Formal contracts for Bit-for-Bit Reproducible Builds, Nix Flake derivations,
 * Bazel hermetic sandboxing, SOURCE_DATE_EPOCH archive normalization, and drift detection.
 *
 * Governed by SPEC-302 (FR-302-01..FR-302-06, BDD-1587..BDD-1592).
 * Strict Law V: Zero third-party runtime dependencies.
 */

export interface BuildArtifactEntry {
  readonly path: string;
  readonly content: Buffer | Uint8Array | string;
  readonly mode?: number;
  readonly mtime?: number;
}

export interface NormalizedArtifactEntry {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly mode: number;
  readonly mtime: number;
  readonly uid: 0;
  readonly gid: 0;
}

export interface NormalizationOptions {
  readonly sourceDateEpoch?: number;
  readonly stripTimestamps?: boolean;
  readonly normalizePermissions?: boolean;
  readonly zeroOwnership?: boolean;
}

export interface ReproducibleBuildResult {
  readonly buildId: string;
  readonly sourceDateEpoch: number;
  readonly totalArtifacts: number;
  readonly rootDigestSha256: string;
  readonly artifacts: readonly NormalizedArtifactEntry[];
}

export type ReproducibilityVerdict = "REPRODUCIBLE_MATCH" | "NON_DETERMINISTIC_DRIFT";

export interface ReproducibilityVerificationResult {
  readonly reproducible: boolean;
  readonly verdict: ReproducibilityVerdict;
  readonly buildAId: string;
  readonly buildBId: string;
  readonly matchedCount: number;
  readonly divergentArtifacts: readonly {
    readonly path: string;
    readonly digestA: string;
    readonly digestB: string;
  }[];
  readonly rootDigestA: string;
  readonly rootDigestB: string;
}

export interface HermeticBuildAuditReceipt {
  readonly timestampIso: string;
  readonly specRef: "SPEC-302";
  readonly totalArtifactsVerified: number;
  readonly reproducibilityRatio: number;
  readonly bitForBitIdentical: boolean;
  readonly rootDigestSha256: string;
  readonly sha256Signature: string;
}
