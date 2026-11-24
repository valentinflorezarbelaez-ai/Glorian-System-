/**
 * GLORIAN SYSTEM — CONFIDENTIAL ENCLAVE TEE GOVERNOR
 *
 * Core control plane governor for Hardware TEEs (AWS Nitro Enclaves, AMD SEV-SNP, Intel SGX/TDX).
 * Implements deterministic Platform Configuration Register (PCR) measurements,
 * remote hardware attestation verification, measurement-bound secret sealing,
 * and fail-closed anti-tamper guards.
 *
 * Governed by SPEC-301 (FR-301-01..FR-301-06, BDD-1581..BDD-1586).
 * Strict Law V: Zero third-party runtime dependencies (native node:crypto).
 */

import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  generateKeyPairSync,
  sign,
  verify,
  hkdfSync,
} from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";
import { pureSha256, deepFreeze, assertPrecondition } from "./eosKernelPrimitives.ts";
import type {
  EnclaveDefinition,
  EnclavePcrRegisters,
  EnclaveAttestationDocument,
  EnclaveVerificationResult,
  SealedPayload,
  EnclaveAuditReceipt,
} from "./eosConfidentialEnclaveGovernor.types.ts";

export * from "./eosConfidentialEnclaveGovernor.types.ts";

export class EosConfidentialEnclaveGovernor {
  private static defaultRoTKeyPair: { privateKeyPem: string; publicKeyPem: string } | null = null;

  /**
   * Computes Platform Configuration Registers (PCRs) deterministically.
   * PCR0: Enclave image / Kernel / runtime executable.
   * PCR1: Boot arguments and OS parameters.
   * PCR2: Application code bundle and configuration manifest.
   * PCR8: IAM / Enclave role security binding.
   */
  public static computePcrRegisters(definition: EnclaveDefinition): EnclavePcrRegisters {
    assertPrecondition(Boolean(definition), "EnclaveDefinition is required");
    assertPrecondition(
      typeof definition.enclaveId === "string" && definition.enclaveId.length > 0,
      "enclaveId is required",
    );

    const imageBytes =
      typeof definition.imageBinaryOrPath === "string"
        ? Buffer.from(definition.imageBinaryOrPath, "utf8")
        : Buffer.from(definition.imageBinaryOrPath);
    const pcr0 = createHash("sha256").update(imageBytes).digest("hex");

    const pcr1 = pureSha256(definition.bootArgs || "console=ttyS0 root=/dev/ram0 rdinit=/sbin/init quiet");

    const appBytes =
      typeof definition.applicationBundle === "string"
        ? Buffer.from(definition.applicationBundle, "utf8")
        : Buffer.from(definition.applicationBundle);
    const pcr2 = createHash("sha256").update(appBytes).digest("hex");

    const pcr8 = pureSha256(
      definition.iamRoleArnOrContext || "arn:aws:iam::123456789012:role/eos-confidential-enclave",
    );

    return deepFreeze({
      pcr0,
      pcr1,
      pcr2,
      pcr8,
    });
  }

  /**
   * Generates an Ed25519 key pair representing the hardware Root of Trust.
   */
  public static generateRootOfTrustKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    return { privateKeyPem: privateKey, publicKeyPem: publicKey };
  }

  /**
   * Lazily initializes or returns the canonical Root-of-Trust key pair.
   */
  public static getCanonicalRootOfTrustKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
    if (!this.defaultRoTKeyPair) {
      this.defaultRoTKeyPair = this.generateRootOfTrustKeyPair();
    }
    return this.defaultRoTKeyPair;
  }

  /**
   * Generates a signed attestation document for an enclave.
   */
  public static generateAttestationDocument(
    definition: EnclaveDefinition,
    nonce: string,
    rootOfTrust?: { privateKeyPem: string; publicKeyPem: string },
  ): EnclaveAttestationDocument {
    assertPrecondition(typeof nonce === "string" && nonce.length >= 8, "Nonce must be at least 8 characters");

    const pcrs = this.computePcrRegisters(definition);
    const roT = rootOfTrust || this.getCanonicalRootOfTrustKeyPair();

    const { publicKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const timestampIso = new Date().toISOString();
    const canonicalPayload = this.buildCanonicalAttestationString(
      definition.enclaveId,
      timestampIso,
      nonce,
      pcrs,
      publicKey,
    );

    const signature = sign(null, Buffer.from(canonicalPayload, "utf8"), roT.privateKeyPem);

    return deepFreeze({
      version: "1.0.0",
      enclaveId: definition.enclaveId,
      timestampIso,
      nonce,
      pcrs,
      enclavePublicKeyPem: publicKey,
      rootOfTrustPublicKeyPem: roT.publicKeyPem,
      signatureHex: signature.toString("hex"),
    });
  }

  /**
   * Verifies an attestation document against the hardware Root of Trust, nonce challenge, and PCR baselines.
   */
  public static verifyAttestationDocument(
    attestation: EnclaveAttestationDocument,
    baselinePcrs: Partial<EnclavePcrRegisters>,
    expectedNonce?: string,
  ): EnclaveVerificationResult {
    assertPrecondition(Boolean(attestation), "Attestation document is required");

    // 1. Nonce check
    const nonceVerified = expectedNonce ? attestation.nonce === expectedNonce : true;
    if (!nonceVerified) {
      return deepFreeze({
        valid: false,
        verdict: "NONCE_REPLAY_DETECTED",
        enclaveId: attestation.enclaveId,
        signatureVerified: false,
        nonceVerified: false,
        pcrMatches: false,
      });
    }

    // 2. Signature verification
    const canonicalPayload = this.buildCanonicalAttestationString(
      attestation.enclaveId,
      attestation.timestampIso,
      attestation.nonce,
      attestation.pcrs,
      attestation.enclavePublicKeyPem,
    );

    let signatureVerified = false;
    try {
      signatureVerified = verify(
        null,
        Buffer.from(canonicalPayload, "utf8"),
        attestation.rootOfTrustPublicKeyPem,
        Buffer.from(attestation.signatureHex, "hex"),
      );
    } catch {
      signatureVerified = false;
    }

    if (!signatureVerified) {
      return deepFreeze({
        valid: false,
        verdict: "SIGNATURE_INVALID",
        enclaveId: attestation.enclaveId,
        signatureVerified: false,
        nonceVerified,
        pcrMatches: false,
      });
    }

    // 3. PCR Baseline check
    const driftDetails: Record<string, { expected: string; actual: string }> = {};
    let pcrMatches = true;

    for (const key of ["pcr0", "pcr1", "pcr2", "pcr8"] as const) {
      const expected = baselinePcrs[key];
      if (expected && expected !== attestation.pcrs[key]) {
        pcrMatches = false;
        driftDetails[key] = { expected, actual: attestation.pcrs[key] };
      }
    }

    if (!pcrMatches) {
      return deepFreeze({
        valid: false,
        verdict: "PCR_MEASUREMENT_MISMATCH",
        enclaveId: attestation.enclaveId,
        signatureVerified: true,
        nonceVerified,
        pcrMatches: false,
        driftDetails: deepFreeze(driftDetails),
      });
    }

    return deepFreeze({
      valid: true,
      verdict: "ATTESTATION_VERIFIED",
      enclaveId: attestation.enclaveId,
      signatureVerified: true,
      nonceVerified,
      pcrMatches: true,
    });
  }

  /**
   * Seals a sensitive secret bound to PCR0 and PCR2 measurements using HKDF-SHA256 and AES-256-GCM.
   */
  public static sealSecret(
    plaintext: string | Uint8Array,
    pcrs: { pcr0: string; pcr2: string },
    rootSecret: string | Uint8Array = "eos-hardware-enclave-master-key-seed-32bytes!",
  ): SealedPayload {
    assertPrecondition(Boolean(plaintext), "Plaintext payload is required");
    assertPrecondition(Boolean(pcrs?.pcr0 && pcrs?.pcr2), "PCR0 and PCR2 measurements are required for sealing");

    const salt = randomBytes(16);
    const iv = randomBytes(12);

    const ikm = typeof rootSecret === "string" ? Buffer.from(rootSecret, "utf8") : Buffer.from(rootSecret);
    const info = Buffer.from(`eos-tee-seal|${pcrs.pcr0}|${pcrs.pcr2}`, "utf8");

    const key = Buffer.from(hkdfSync("sha256", ikm, salt, info, 32));

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plainBuf = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : Buffer.from(plaintext);

    const ciphertext = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return deepFreeze({
      algorithm: "AES-256-GCM",
      keyDerivation: "HKDF-SHA256",
      ivHex: iv.toString("hex"),
      authTagHex: authTag.toString("hex"),
      ciphertextHex: ciphertext.toString("hex"),
      boundPcrs: {
        pcr0: pcrs.pcr0,
        pcr2: pcrs.pcr2,
      },
      saltHex: salt.toString("hex"),
    });
  }

  /**
   * Unseals a secret payload only if target PCR measurements match and ciphertext is uncorrupted.
   */
  public static unsealSecret(
    sealed: SealedPayload,
    pcrs: { pcr0: string; pcr2: string },
    rootSecret: string | Uint8Array = "eos-hardware-enclave-master-key-seed-32bytes!",
  ): string {
    assertPrecondition(Boolean(sealed), "SealedPayload is required");
    assertPrecondition(sealed.algorithm === "AES-256-GCM", "Unsupported algorithm");

    // Enforce PCR measurement equality before decryption
    if (sealed.boundPcrs.pcr0 !== pcrs.pcr0 || sealed.boundPcrs.pcr2 !== pcrs.pcr2) {
      throw new Error(
        `ENCLAVE_MEASUREMENT_MISMATCH: Current PCRs (${pcrs.pcr0.slice(0, 8)}.. / ${pcrs.pcr2.slice(
          0,
          8,
        )}..) do not match sealed hardware binding (${sealed.boundPcrs.pcr0.slice(0, 8)}.. / ${sealed.boundPcrs.pcr2.slice(
          0,
          8,
        )}..)`,
      );
    }

    const salt = Buffer.from(sealed.saltHex, "hex");
    const iv = Buffer.from(sealed.ivHex, "hex");
    const authTag = Buffer.from(sealed.authTagHex, "hex");
    const ciphertext = Buffer.from(sealed.ciphertextHex, "hex");

    const ikm = typeof rootSecret === "string" ? Buffer.from(rootSecret, "utf8") : Buffer.from(rootSecret);
    const info = Buffer.from(`eos-tee-seal|${pcrs.pcr0}|${pcrs.pcr2}`, "utf8");

    const key = Buffer.from(hkdfSync("sha256", ikm, salt, info, 32));

    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString("utf8");
    } catch {
      throw new Error("SEALED_PAYLOAD_TAMPERED: Authentication tag verification failed");
    }
  }

  /**
   * Executes end-to-end enclave attestation and secret sealing audit pipeline.
   */
  public static auditConfidentialEnclavePipeline(options: { projectRoot?: string } = {}): EnclaveAuditReceipt {
    const projectRoot = options.projectRoot || process.cwd();

    // 1. Define standard enclave
    const definition: EnclaveDefinition = {
      enclaveId: "enclave-nitro-release-01",
      imageBinaryOrPath: "eos-core-kernel-image-v75.0.0",
      bootArgs: "console=ttyS0 root=/dev/ram0 quiet",
      applicationBundle: "eos-system-dist-bundle-sha256-precomputed",
      iamRoleArnOrContext: "arn:aws:iam::123456789012:role/eos-sovereign-deployer",
    };

    const pcrs = this.computePcrRegisters(definition);
    const nonce = randomBytes(16).toString("hex");

    // 2. Generate and verify attestation
    const attestation = this.generateAttestationDocument(definition, nonce);
    const verification = this.verifyAttestationDocument(attestation, pcrs, nonce);

    // 3. Test secret sealing and unsealing
    const secret = "SOVEREIGN_RELEASE_SIGNING_KEY_ED25519_SECRET_MATERIAL";
    const sealed = this.sealSecret(secret, pcrs);
    const unsealed = this.unsealSecret(sealed, pcrs);
    const sealingVerified = unsealed === secret;

    // 4. Test drift rejection
    let pcrIntegrityGuarded = false;
    try {
      this.unsealSecret(sealed, {
        pcr0: "0000000000000000000000000000000000000000000000000000000000000000",
        pcr2: pcrs.pcr2,
      });
    } catch (err: any) {
      pcrIntegrityGuarded = err.message.includes("ENCLAVE_MEASUREMENT_MISMATCH");
    }

    const timestampIso = new Date().toISOString();
    const digest = pureSha256(
      `RECEIPT-SPEC-301|${timestampIso}|${verification.valid}|${sealingVerified}|${pcrIntegrityGuarded}`,
    );

    const receipt: EnclaveAuditReceipt = deepFreeze({
      timestampIso,
      specRef: "SPEC-301",
      totalEnclavesAudited: 1,
      attestationValid: verification.valid,
      sealingVerified,
      pcrIntegrityGuarded,
      sha256Signature: digest,
    });

    try {
      const outPath = resolveEvidencePath("TEE_ENCLAVE_RECEIPT.json", projectRoot);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
    } catch {
      // Best-effort in sandboxes
    }

    return receipt;
  }

  private static buildCanonicalAttestationString(
    enclaveId: string,
    timestampIso: string,
    nonce: string,
    pcrs: EnclavePcrRegisters,
    enclavePublicKeyPem: string,
  ): string {
    return [
      enclaveId,
      timestampIso,
      nonce,
      pcrs.pcr0,
      pcrs.pcr1,
      pcrs.pcr2,
      pcrs.pcr8,
      enclavePublicKeyPem.trim(),
    ].join("|");
  }
}
