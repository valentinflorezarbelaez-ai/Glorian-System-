/**
 * GLORIAN SYSTEM — CONFIDENTIAL ENCLAVE TEE GOVERNOR TEST SUITE
 *
 * Verifies Hardware TEE isolation, Platform Configuration Register (PCR) measurements,
 * remote attestation verification, measurement-bound secret sealing, and anti-tamper guards.
 *
 * Governed by SPEC-301 (FR-301-01..FR-301-06, BDD-1581..BDD-1586).
 * Strict Law V: Zero third-party runtime dependencies. Uses node:test and node:assert/strict.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosConfidentialEnclaveGovernor } from "../src/core/eosConfidentialEnclaveGovernor.ts";

const SAMPLE_ENCLAVE = {
  enclaveId: "enclave-test-01",
  imageBinaryOrPath: "eos-core-kernel-image-test-bytes-2026",
  bootArgs: "console=ttyS0 root=/dev/ram0 quiet",
  applicationBundle: "eos-app-bundle-test-code-content",
  iamRoleArnOrContext: "arn:aws:iam::123456789012:role/eos-test-enclave-role",
};

describe("SPEC-301: Confidential Computing in Hardware TEEs (AWS Nitro / AMD SEV-SNP)", () => {
  it("BDD-1581: Hardware Platform Configuration Register (PCR) Measurement Computation", () => {
    const pcrs1 = EosConfidentialEnclaveGovernor.computePcrRegisters(SAMPLE_ENCLAVE);
    const pcrs2 = EosConfidentialEnclaveGovernor.computePcrRegisters(SAMPLE_ENCLAVE);

    // Assert 64-char hex strings
    assert.match(pcrs1.pcr0, /^[0-9a-f]{64}$/);
    assert.match(pcrs1.pcr1, /^[0-9a-f]{64}$/);
    assert.match(pcrs1.pcr2, /^[0-9a-f]{64}$/);
    assert.match(pcrs1.pcr8, /^[0-9a-f]{64}$/);

    // Assert bit-for-bit determinism
    assert.equal(pcrs1.pcr0, pcrs2.pcr0);
    assert.equal(pcrs1.pcr1, pcrs2.pcr1);
    assert.equal(pcrs1.pcr2, pcrs2.pcr2);
    assert.equal(pcrs1.pcr8, pcrs2.pcr8);

    // Assert altered input produces distinct PCR
    const altered = EosConfidentialEnclaveGovernor.computePcrRegisters({
      ...SAMPLE_ENCLAVE,
      applicationBundle: "malicious-modified-code",
    });
    assert.notEqual(pcrs1.pcr2, altered.pcr2);
    assert.equal(pcrs1.pcr0, altered.pcr0);
  });

  it("BDD-1582: Enclave Attestation Document Generation and Nonce Freshness", () => {
    const nonce = "unique-cryptographic-nonce-84729104";
    const attestation = EosConfidentialEnclaveGovernor.generateAttestationDocument(SAMPLE_ENCLAVE, nonce);

    assert.equal(attestation.version, "1.0.0");
    assert.equal(attestation.enclaveId, SAMPLE_ENCLAVE.enclaveId);
    assert.equal(attestation.nonce, nonce);
    assert.ok(attestation.enclavePublicKeyPem.includes("BEGIN PUBLIC KEY"));
    assert.ok(attestation.rootOfTrustPublicKeyPem.includes("BEGIN PUBLIC KEY"));
    assert.match(attestation.signatureHex, /^[0-9a-f]{128}$/); // Ed25519 signature is 64 bytes = 128 hex chars
    assert.equal(attestation.pcrs.pcr0.length, 64);
  });

  it("BDD-1583: Cryptographic Attestation Verification against Root-of-Trust", () => {
    const nonce = "fresh-session-nonce-abcdef0123456789";
    const attestation = EosConfidentialEnclaveGovernor.generateAttestationDocument(SAMPLE_ENCLAVE, nonce);
    const expectedPcrs = attestation.pcrs;

    // 1. Nominal verification
    const res = EosConfidentialEnclaveGovernor.verifyAttestationDocument(attestation, expectedPcrs, nonce);
    assert.equal(res.valid, true);
    assert.equal(res.verdict, "ATTESTATION_VERIFIED");
    assert.equal(res.signatureVerified, true);
    assert.equal(res.nonceVerified, true);
    assert.equal(res.pcrMatches, true);

    // 2. Nonce replay rejection
    const replayRes = EosConfidentialEnclaveGovernor.verifyAttestationDocument(
      attestation,
      expectedPcrs,
      "stale-replayed-nonce-99999999",
    );
    assert.equal(replayRes.valid, false);
    assert.equal(replayRes.verdict, "NONCE_REPLAY_DETECTED");

    // 3. Signature forgery rejection
    const forged = {
      ...attestation,
      signatureHex: "00".repeat(64),
    };
    const forgedRes = EosConfidentialEnclaveGovernor.verifyAttestationDocument(forged, expectedPcrs, nonce);
    assert.equal(forgedRes.valid, false);
    assert.equal(forgedRes.verdict, "SIGNATURE_INVALID");

    // 4. PCR baseline mismatch rejection
    const mismatchedPcrs = {
      ...expectedPcrs,
      pcr0: "1111111111111111111111111111111111111111111111111111111111111111",
    };
    const mismatchRes = EosConfidentialEnclaveGovernor.verifyAttestationDocument(attestation, mismatchedPcrs, nonce);
    assert.equal(mismatchRes.valid, false);
    assert.equal(mismatchRes.verdict, "PCR_MEASUREMENT_MISMATCH");
    assert.ok(mismatchRes.driftDetails?.pcr0);
  });

  it("BDD-1584: Hardware-Bound Secret Sealing (AES-256-GCM + PCR0/PCR2 Derivation)", () => {
    const secret = "TOP_SECRET_SOVEREIGN_PRIVATE_KEY_PAYLOAD_2026";
    const pcrs = EosConfidentialEnclaveGovernor.computePcrRegisters(SAMPLE_ENCLAVE);

    const sealed = EosConfidentialEnclaveGovernor.sealSecret(secret, pcrs);
    assert.equal(sealed.algorithm, "AES-256-GCM");
    assert.equal(sealed.keyDerivation, "HKDF-SHA256");
    assert.equal(sealed.ivHex.length, 24); // 12 bytes
    assert.equal(sealed.authTagHex.length, 32); // 16 bytes
    assert.equal(sealed.boundPcrs.pcr0, pcrs.pcr0);
    assert.equal(sealed.boundPcrs.pcr2, pcrs.pcr2);

    const unsealed = EosConfidentialEnclaveGovernor.unsealSecret(sealed, pcrs);
    assert.equal(unsealed, secret);
  });

  it("BDD-1585: Tamper Rejection and PCR Measurement Drift Enforcement", () => {
    const secret = "CONFIDENTIAL_DEPLOYMENT_TOKEN";
    const pcrs = EosConfidentialEnclaveGovernor.computePcrRegisters(SAMPLE_ENCLAVE);
    const sealed = EosConfidentialEnclaveGovernor.sealSecret(secret, pcrs);

    // 1. PCR measurement drift rejection
    const driftedPcrs = {
      pcr0: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      pcr2: pcrs.pcr2,
    };
    assert.throws(
      () => EosConfidentialEnclaveGovernor.unsealSecret(sealed, driftedPcrs),
      /ENCLAVE_MEASUREMENT_MISMATCH/,
    );

    // 2. Ciphertext tampering rejection
    const tamperedCiphertext =
      sealed.ciphertextHex.slice(0, -2) + (sealed.ciphertextHex.slice(-2) === "00" ? "ff" : "00");
    const tamperedPayload = {
      ...sealed,
      ciphertextHex: tamperedCiphertext,
    };
    assert.throws(() => EosConfidentialEnclaveGovernor.unsealSecret(tamperedPayload, pcrs), /SEALED_PAYLOAD_TAMPERED/);
  });

  it("BDD-1586: End-to-End Cryptographic Audit Receipt Generation", () => {
    const projectRoot = process.cwd();
    const receipt = EosConfidentialEnclaveGovernor.auditConfidentialEnclavePipeline({ projectRoot });

    assert.equal(receipt.specRef, "SPEC-301");
    assert.equal(receipt.totalEnclavesAudited, 1);
    assert.equal(receipt.attestationValid, true);
    assert.equal(receipt.sealingVerified, true);
    assert.equal(receipt.pcrIntegrityGuarded, true);
    assert.match(receipt.sha256Signature, /^[0-9a-f]{64}$/);

    const receiptPath = resolveEvidencePath("TEE_ENCLAVE_RECEIPT.json", projectRoot);
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });

  it("BDD-1587: Uint8Array inputs, default fields, custom Root-of-Trust, partial PCRs, and malformed PEM", () => {
    // Buffer / Uint8Array inputs with omitted bootArgs and iamRoleArnOrContext
    const binPcrs = EosConfidentialEnclaveGovernor.computePcrRegisters({
      enclaveId: "enclave-bin-02",
      imageBinaryOrPath: new Uint8Array([1, 2, 3, 4]),
      applicationBundle: Buffer.from("binary-app-bundle"),
    });
    assert.match(binPcrs.pcr0, /^[0-9a-f]{64}$/);
    assert.match(binPcrs.pcr1, /^[0-9a-f]{64}$/);
    assert.match(binPcrs.pcr8, /^[0-9a-f]{64}$/);

    // Precondition rejections for computePcrRegisters & generateAttestationDocument
    assert.throws(() => EosConfidentialEnclaveGovernor.computePcrRegisters(null), /EnclaveDefinition is required/);
    assert.throws(
      () =>
        EosConfidentialEnclaveGovernor.computePcrRegisters({
          ...SAMPLE_ENCLAVE,
          enclaveId: "",
        }),
      /enclaveId is required/,
    );
    assert.throws(
      () => EosConfidentialEnclaveGovernor.generateAttestationDocument(SAMPLE_ENCLAVE, "short"),
      /Nonce must be at least 8 characters/,
    );

    // Custom Root-of-Trust keypair and omitted expectedNonce + partial baselinePcrs
    const customRoT = EosConfidentialEnclaveGovernor.generateRootOfTrustKeyPair();
    const att = EosConfidentialEnclaveGovernor.generateAttestationDocument(
      SAMPLE_ENCLAVE,
      "nonce-custom-rot-1234",
      customRoT,
    );
    assert.equal(att.rootOfTrustPublicKeyPem, customRoT.publicKeyPem);

    const verifiedNoNonce = EosConfidentialEnclaveGovernor.verifyAttestationDocument(att, { pcr0: att.pcrs.pcr0 });
    assert.equal(verifiedNoNonce.valid, true);
    assert.equal(verifiedNoNonce.nonceVerified, true);

    // Null attestation precondition
    assert.throws(
      () => EosConfidentialEnclaveGovernor.verifyAttestationDocument(null, {}),
      /Attestation document is required/,
    );

    // Malformed Root-of-Trust PEM triggers verify() catch branch -> SIGNATURE_INVALID
    const badPemAtt = {
      ...att,
      rootOfTrustPublicKeyPem: "NOT-A-VALID-PEM-KEY",
    };
    const badPemRes = EosConfidentialEnclaveGovernor.verifyAttestationDocument(badPemAtt, att.pcrs);
    assert.equal(badPemRes.valid, false);
    assert.equal(badPemRes.verdict, "SIGNATURE_INVALID");
  });

  it("BDD-1588: Sealing preconditions, binary secrets/rootSecret, PCR2 drift, and sandbox audit fallback", () => {
    const pcrs = EosConfidentialEnclaveGovernor.computePcrRegisters(SAMPLE_ENCLAVE);
    const customRoot = new Uint8Array(32).fill(7);
    const plainBytes = Buffer.from("BINARY_SECRET_MATERIAL_99");

    const sealed = EosConfidentialEnclaveGovernor.sealSecret(plainBytes, pcrs, customRoot);
    const unsealed = EosConfidentialEnclaveGovernor.unsealSecret(sealed, pcrs, customRoot);
    assert.equal(unsealed, "BINARY_SECRET_MATERIAL_99");

    // Preconditions on sealSecret & unsealSecret
    assert.throws(() => EosConfidentialEnclaveGovernor.sealSecret("", pcrs), /Plaintext payload is required/);
    assert.throws(
      () => EosConfidentialEnclaveGovernor.sealSecret("abc", { pcr0: "", pcr2: pcrs.pcr2 }),
      /PCR0 and PCR2 measurements are required/,
    );
    assert.throws(() => EosConfidentialEnclaveGovernor.unsealSecret(null, pcrs), /SealedPayload is required/);
    assert.throws(
      () => EosConfidentialEnclaveGovernor.unsealSecret({ ...sealed, algorithm: "AES-128-CBC" }, pcrs),
      /Unsupported algorithm/,
    );

    // PCR2-only mismatch (matching PCR0)
    assert.throws(
      () =>
        EosConfidentialEnclaveGovernor.unsealSecret(sealed, {
          pcr0: pcrs.pcr0,
          pcr2: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        }),
      /ENCLAVE_MEASUREMENT_MISMATCH/,
    );

    // Default audit options + best-effort sandbox write failure catch branch
    const defaultReceipt = EosConfidentialEnclaveGovernor.auditConfidentialEnclavePipeline();
    assert.equal(defaultReceipt.attestationValid, true);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-enclave-ro-"));
    const blockingFile = path.join(tmpDir, "not-a-dir");
    fs.writeFileSync(blockingFile, "lock", "utf8");
    const prevEnv = process.env.EOS_EVIDENCE_DIR;
    try {
      process.env.EOS_EVIDENCE_DIR = blockingFile;
      const sandboxReceipt = EosConfidentialEnclaveGovernor.auditConfidentialEnclavePipeline();
      assert.equal(sandboxReceipt.specRef, "SPEC-301");
      assert.equal(sandboxReceipt.attestationValid, true);
    } finally {
      if (prevEnv === undefined) {
        delete process.env.EOS_EVIDENCE_DIR;
      } else {
        process.env.EOS_EVIDENCE_DIR = prevEnv;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
