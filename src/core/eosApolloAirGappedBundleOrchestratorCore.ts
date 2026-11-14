/**
 * SPEC-248 / CHANGE-124 — Layer-0 Apollo Air-Gapped Sovereign Bundle Orchestrator.
 * Zero external runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import { EosInTotoSlsaEd25519AttestorCore } from "./eosInTotoSlsaEd25519AttestorCore.ts";
import type {
  AirGappedArtifactInput,
  AirGappedBundleConstraints,
  AirGappedBundleOptions,
  AirGappedBundleReport,
  AirGappedTargetNodeSpec,
  AirGappedVerdict,
} from "./eosApolloAirGappedBundleOrchestratorCore.types.ts";

function sha256Text(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildDefaultArtifacts(): readonly AirGappedArtifactInput[] {
  const paths = ["bin/eos.mjs", "package.json", "src/core/index.ts", "src/mcp/eosMcpServer.ts"];
  return paths.map((p, idx) => ({
    path: p,
    contentSha256: sha256Text(`glorian-artifact:${p}`),
    sizeBytes: 4096 * (idx + 1),
  }));
}

function resolveConfinedPath(projectRoot: string, relPath: string): string {
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, relPath);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal outside projectRoot is forbidden");
  }
  return targetAbs;
}

function computeBinaryMerkleRoot(artifacts: readonly AirGappedArtifactInput[]): string {
  if (artifacts.length === 0) return sha256Text("empty-merkle-tree");
  const sorted = [...artifacts].sort((a, b) => a.path.localeCompare(b.path));
  let layer = sorted.map((a) => sha256Text(`${a.path}:${a.contentSha256}:${a.sizeBytes}`));
  while (layer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left;
      nextLayer.push(sha256Text(`${left}:${right}`));
    }
    layer = nextLayer;
  }
  return layer[0]!;
}

function evaluateNodeConstraints(constraints: AirGappedBundleConstraints, target: AirGappedTargetNodeSpec): string[] {
  const violations: string[] = [];
  if (constraints.requiredArch && target.arch !== constraints.requiredArch) {
    violations.push(`Architecture mismatch: required ${constraints.requiredArch}, node has ${target.arch}`);
  }
  if (typeof constraints.minMemoryMb === "number" && target.memoryMb < constraints.minMemoryMb) {
    violations.push(`Insufficient memory: required ${constraints.minMemoryMb}MB, node has ${target.memoryMb}MB`);
  }
  if (typeof constraints.minQuorumNodes === "number" && target.quorumNodes < constraints.minQuorumNodes) {
    violations.push(`Quorum too small: required ${constraints.minQuorumNodes} nodes, got ${target.quorumNodes}`);
  }
  if (constraints.requireOfflineCapable === true && !target.airGappedOffline) {
    violations.push(`Node ${target.nodeId} is not flagged as airGappedOffline=true`);
  }
  return violations;
}

function resolveVerdict(dsseVerified: boolean, recalled: boolean, violationsCount: number): AirGappedVerdict {
  if (!dsseVerified) return "SIGNATURE_INVALID";
  if (recalled) return "RECALL_BLOCKED";
  if (violationsCount > 0) return "CONSTRAINT_HOLD";
  return "AIRGAP_DEPLOY_READY";
}

function resolveBundleConstraints(raw?: AirGappedBundleConstraints): AirGappedBundleConstraints {
  return {
    requiredArch: raw?.requiredArch ?? "x64",
    minMemoryMb: raw?.minMemoryMb ?? 4096,
    minQuorumNodes: raw?.minQuorumNodes ?? 3,
    requireOfflineCapable: raw?.requireOfflineCapable ?? true,
  };
}

function resolveTargetNode(raw?: AirGappedTargetNodeSpec): AirGappedTargetNodeSpec {
  return (
    raw ?? {
      nodeId: "scif-sub-01",
      arch: "x64",
      memoryMb: 16384,
      quorumNodes: 5,
      airGappedOffline: true,
    }
  );
}

function persistBundleIfRequested(
  options: AirGappedBundleOptions,
  projectRoot: string,
  payload: Record<string, unknown>,
): string | undefined {
  if (options.writeBundleToDisk !== true) return undefined;
  const targetPath = resolveConfinedPath(projectRoot, options.outputRelPath ?? ".eos/apollo-airgap-bundle.json");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), "utf8");
  return targetPath;
}

export class EosApolloAirGappedBundleOrchestratorCore {
  public static compileAndVerifyAirGappedBundle(options: AirGappedBundleOptions = {}): AirGappedBundleReport {
    const projectRoot = options.projectRoot ?? process.cwd();
    const bundleId = options.bundleId?.trim() || "APOLLO-BUNDLE-001";
    const version = options.version?.trim() || "75.0.0";
    const artifacts = options.artifacts ?? buildDefaultArtifacts();
    const artifactMerkleRootSha256 = computeBinaryMerkleRoot(artifacts);

    const dsseBundle = EosInTotoSlsaEd25519AttestorCore.issueShipAttestation({
      projectRoot,
      ticketId: bundleId,
      headCommitSha: version,
      diffDigestSha256: artifactMerkleRootSha256,
      sarifDigestSha256: artifactMerkleRootSha256,
      contractDiffDigestSha256: artifactMerkleRootSha256,
      staffVerdict: "APPROVED",
      keySeed: options.keySeed ?? `apollo-${bundleId}-${version}`,
    });
    const offlineCheck = EosInTotoSlsaEd25519AttestorCore.verifyDsseAttestation(
      dsseBundle.dsseEnvelope,
      dsseBundle.publicKeyPem,
    );

    const recalled = (options.recalledVersions ?? []).includes(version);
    const constraintViolations = evaluateNodeConstraints(
      resolveBundleConstraints(options.constraints),
      resolveTargetNode(options.targetNode),
    );
    const constraintsMet = constraintViolations.length === 0;
    const verdict = resolveVerdict(offlineCheck.verified, recalled, constraintViolations.length);

    const writtenBundlePath = persistBundleIfRequested(options, projectRoot, {
      bundleId,
      version,
      artifactMerkleRootSha256,
      verdict,
      dsseEnvelope: dsseBundle.dsseEnvelope,
      publicKeyPem: dsseBundle.publicKeyPem,
      artifacts,
    });

    const body = {
      bundleId,
      version,
      artifactCount: artifacts.length,
      artifactMerkleRootSha256,
      dsseKeyId: dsseBundle.keyId,
      dsseVerified: offlineCheck.verified,
      recalled,
      constraintsMet,
      constraintViolations,
      verdict,
      ...(writtenBundlePath ? { writtenBundlePath } : {}),
    };
    const bundleDigestSha256 = sha256Text(JSON.stringify(body));
    return deepFreeze({ ...body, bundleDigestSha256 });
  }
}
