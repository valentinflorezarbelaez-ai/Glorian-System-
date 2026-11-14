/**
 * SPEC-248 / CHANGE-124 — Layer-0 Apollo Air-Gapped Sovereign Bundle Orchestrator Types.
 */

export interface AirGappedArtifactInput {
  readonly path: string;
  readonly contentSha256: string;
  readonly sizeBytes: number;
}

export interface AirGappedBundleConstraints {
  readonly requiredArch?: string;
  readonly minMemoryMb?: number;
  readonly minQuorumNodes?: number;
  readonly requireOfflineCapable?: boolean;
}

export interface AirGappedTargetNodeSpec {
  readonly nodeId: string;
  readonly arch: string;
  readonly memoryMb: number;
  readonly quorumNodes: number;
  readonly airGappedOffline: boolean;
}

export interface AirGappedBundleOptions {
  readonly projectRoot?: string;
  readonly bundleId?: string;
  readonly version?: string;
  readonly artifacts?: readonly AirGappedArtifactInput[];
  readonly recalledVersions?: readonly string[];
  readonly constraints?: AirGappedBundleConstraints;
  readonly targetNode?: AirGappedTargetNodeSpec;
  readonly keySeed?: string;
  readonly writeBundleToDisk?: boolean;
  readonly outputRelPath?: string;
}

export type AirGappedVerdict = "AIRGAP_DEPLOY_READY" | "RECALL_BLOCKED" | "CONSTRAINT_HOLD" | "SIGNATURE_INVALID";

export interface AirGappedBundleReport {
  readonly bundleId: string;
  readonly version: string;
  readonly artifactCount: number;
  readonly artifactMerkleRootSha256: string;
  readonly dsseKeyId: string;
  readonly dsseVerified: boolean;
  readonly recalled: boolean;
  readonly constraintsMet: boolean;
  readonly constraintViolations: readonly string[];
  readonly verdict: AirGappedVerdict;
  readonly writtenBundlePath?: string;
  readonly bundleDigestSha256: string;
}
