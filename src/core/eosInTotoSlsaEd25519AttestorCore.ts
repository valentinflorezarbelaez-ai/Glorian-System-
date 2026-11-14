/**
 * SPEC-245 / CHANGE-123 — Layer-0 In-Toto Statement v1 & SLSA v1.0 Ed25519 Attestor.
 * Generates and cryptographically verifies DSSE v1 envelopes carrying In-Toto
 * Statement v1 / SLSA Provenance v1.0 payloads using native Node.js Ed25519 keys.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import type {
  DsseEnvelope,
  InTotoStatementV1,
  IssueShipAttestationOptions,
  ShipAttestationBundle,
  VerifyDsseAttestationResult,
} from "./eosInTotoSlsaEd25519AttestorCore.types.ts";

const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const INTOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";

function resolveConfinedPath(projectRoot: string, relPath: string): string {
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, relPath);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal outside projectRoot is forbidden");
  }
  return targetAbs;
}

function deriveDeterministicEd25519Pair(keySeed: string): {
  privateKey: crypto.KeyObject;
  publicKeyPem: string;
  keyId: string;
} {
  const seedDigest = crypto.createHash("sha256").update(keySeed).digest();
  const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, seedDigest]);
  const privateKey = crypto.createPrivateKey({ key: pkcs8Der, format: "der", type: "pkcs8" });
  const publicKeyPem = crypto.createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
  const keyId = "ed25519:" + crypto.createHash("sha256").update(publicKeyPem).digest("hex").slice(0, 16);
  return { privateKey, publicKeyPem, keyId };
}

function computeDssePae(payloadType: string, payloadBytes: Buffer): Buffer {
  const header = `DSSEv1 ${Buffer.byteLength(payloadType)} ${payloadType} ${payloadBytes.length} `;
  return Buffer.concat([Buffer.from(header, "utf8"), payloadBytes]);
}

function normalizeSha256Hex(raw: string | undefined, label: string): string {
  if (typeof raw === "string" && /^[0-9a-f]{64}$/i.test(raw.trim())) {
    return raw.trim().toLowerCase();
  }
  return crypto
    .createHash("sha256")
    .update(raw ?? label)
    .digest("hex");
}

export class EosInTotoSlsaEd25519AttestorCore {
  static verifyDsseAttestation(envelope: DsseEnvelope, publicKeyPem: string): VerifyDsseAttestationResult {
    const firstSig = envelope?.signatures?.[0];
    const keyId = firstSig?.keyid ?? "";
    const payloadType = envelope?.payloadType ?? "";
    if (payloadType !== INTOTO_PAYLOAD_TYPE || !firstSig?.sigBase64 || !envelope?.payloadBase64) {
      return deepFreeze({
        verified: false,
        keyId,
        payloadType,
        failureReason: "Invalid DSSE envelope structure or payloadType.",
      });
    }
    try {
      const payloadBytes = Buffer.from(envelope.payloadBase64, "base64");
      const paeBytes = computeDssePae(payloadType, payloadBytes);
      const sigBytes = Buffer.from(firstSig.sigBase64, "base64");
      const signatureValid = crypto.verify(null, paeBytes, publicKeyPem, sigBytes);
      if (!signatureValid) {
        return deepFreeze({
          verified: false,
          keyId,
          payloadType,
          failureReason: "Ed25519 DSSE signature mismatch (payload or signature tampered).",
        });
      }
      const statement = JSON.parse(payloadBytes.toString("utf8")) as InTotoStatementV1;
      return deepFreeze({ verified: true, keyId, payloadType, statement });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return deepFreeze({ verified: false, keyId, payloadType, failureReason: `DSSE verification error: ${msg}` });
    }
  }

  static issueShipAttestation(options: IssueShipAttestationOptions = {}): ShipAttestationBundle {
    const rootAbs = path.resolve(options.projectRoot ?? process.cwd());
    const outputRelPath = options.outputRelPath ?? ".eos/ship-attestation.intoto.json";
    const resolvedOutput = options.writeAttestationToDisk ? resolveConfinedPath(rootAbs, outputRelPath) : undefined;

    const ticketId = (options.ticketId ?? "SHIP-245").trim() || "SHIP-245";
    const headCommitSha = (options.headCommitSha ?? "HEAD").trim() || "HEAD";
    const keySeed = options.keySeed ?? `glorian-ship-key-${ticketId}`;
    const { privateKey, publicKeyPem, keyId } = deriveDeterministicEd25519Pair(keySeed);

    const statement: InTotoStatementV1 = {
      _type: "https://in-toto.io/Statement/v1",
      subject: [
        { name: `git-diff:${ticketId}`, digest: { sha256: normalizeSha256Hex(options.diffDigestSha256, "diff") } },
        { name: `sarif-2.1.0:${ticketId}`, digest: { sha256: normalizeSha256Hex(options.sarifDigestSha256, "sarif") } },
        {
          name: `contract-diff:${ticketId}`,
          digest: { sha256: normalizeSha256Hex(options.contractDiffDigestSha256, "contract") },
        },
      ],
      predicateType: "https://slsa.dev/provenance/v1",
      predicate: {
        buildDefinition: {
          buildType: "https://glorian-system.vercel.app/slsa/ShipVerification/v1",
          externalParameters: {
            ticketId,
            headCommitSha,
            staffVerdict: options.staffVerdict ?? "APPROVED",
          },
        },
        runDetails: {
          builder: { id: "https://glorian-system.vercel.app/builders/layer0-node24" },
          metadata: { invocationId: `glorian-ship-${ticketId}-${headCommitSha}` },
        },
      },
    };

    const payloadBytes = Buffer.from(JSON.stringify(statement), "utf8");
    const paeBytes = computeDssePae(INTOTO_PAYLOAD_TYPE, payloadBytes);
    const sigBase64 = crypto.sign(null, paeBytes, privateKey).toString("base64");
    const dsseEnvelope: DsseEnvelope = {
      payloadType: INTOTO_PAYLOAD_TYPE,
      payloadBase64: payloadBytes.toString("base64"),
      signatures: [{ keyid: keyId, sigBase64 }],
    };

    const verification = this.verifyDsseAttestation(dsseEnvelope, publicKeyPem);
    const digestPayload = { ticketId, keyId, statement, dsseEnvelope, verified: verification.verified };
    const attestationDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(digestPayload)).digest("hex");

    if (resolvedOutput) {
      fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
      fs.writeFileSync(
        resolvedOutput,
        JSON.stringify({ ticketId, keyId, publicKeyPem, dsseEnvelope, attestationDigestSha256 }, null, 2) + "\n",
        "utf8",
      );
    }

    return deepFreeze({
      ...digestPayload,
      publicKeyPem,
      ...(resolvedOutput ? { writtenAttestationPath: resolvedOutput } : {}),
      attestationDigestSha256,
    });
  }
}
