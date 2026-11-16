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
import path from "node:path";
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

    const receiptPath = path.join(projectRoot, "docs", "evidence", "TEE_ENCLAVE_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });
});
