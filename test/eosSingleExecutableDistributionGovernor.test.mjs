/**
 * GLORIAN SYSTEM — SINGLE EXECUTABLE APPLICATION DISTRIBUTION TEST SUITE
 *
 * Verifies target architecture matrix resolution, deterministic SEA config synthesis,
 * dual Ed25519 and ML-DSA post-quantum code signing, fail-closed anti-tamper guards,
 * and in-toto distribution bundle packaging.
 *
 * Governed by SPEC-304 (FR-304-01..FR-304-06, BDD-1599..BDD-1604).
 * Strict Law V: Zero third-party runtime dependencies. Uses node:test and node:assert/strict.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosSingleExecutableDistributionGovernor } from "../src/core/eosSingleExecutableDistributionGovernor.ts";

describe("SPEC-304: Single Executable Applications (SEA) Automated Binary Distribution", () => {
  it("BDD-1599: Cross-Platform Target Matrix Validation", () => {
    const matrix = EosSingleExecutableDistributionGovernor.getTargetMatrix();
    const platforms = Object.keys(matrix);

    assert.strictEqual(platforms.length, 5, "Must declare exactly 5 tier-1 platforms");
    assert.deepStrictEqual(
      platforms.sort(),
      ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64"].sort(),
      "Target platforms must match tier-1 platform list",
    );

    // Verify Windows
    assert.strictEqual(matrix["win32-x64"].executableExtension, ".exe");
    assert.strictEqual(matrix["win32-x64"].binaryName, "eos-win32-x64.exe");
    assert.strictEqual(matrix["win32-x64"].nodeSeaFuse, true);

    // Verify Linux
    assert.strictEqual(matrix["linux-x64"].executableExtension, "");
    assert.strictEqual(matrix["linux-x64"].binaryName, "eos-linux-x64");
    assert.strictEqual(matrix["linux-x64"].nodeSeaFuse, true);

    // Verify Darwin (macOS)
    assert.strictEqual(matrix["darwin-arm64"].os, "darwin");
    assert.strictEqual(matrix["darwin-arm64"].arch, "arm64");
    assert.strictEqual(matrix["darwin-arm64"].nodeSeaFuse, true);
  });

  it("BDD-1600: Deterministic SEA Config and Blob Synthesis", () => {
    const config = EosSingleExecutableDistributionGovernor.generateSeaConfig("bin/eos.mjs", "dist/eos.blob");

    assert.strictEqual(config.main, "bin/eos.mjs");
    assert.strictEqual(config.output, "dist/eos.blob");
    assert.strictEqual(config.disableExperimentalSEAWarning, true);
    assert.strictEqual(config.useSnapshot, false);
    assert.strictEqual(config.useCodeCache, false);
  });

  it("BDD-1601: Dual Cryptographic Code Signing (Ed25519 + Post-Quantum ML-DSA)", () => {
    const keypair = EosSingleExecutableDistributionGovernor.generateDualKeyPair();
    assert.ok(keypair.publicKeyPem.includes("BEGIN PUBLIC KEY"));
    assert.ok(keypair.privateKeyPem.includes("BEGIN PRIVATE KEY"));
    assert.ok(keypair.pqcKeyId.startsWith("pqc-mldsa65-"));

    const payload = "Glorian-Stand-Alone-Binary-Execution-Payload-Test-2026";
    const signature = EosSingleExecutableDistributionGovernor.signBinaryArtifact(payload, keypair);

    assert.ok(signature.signatureHex.length > 64, "Ed25519 signature must be hex encoded");
    assert.strictEqual(signature.pqcAlgorithm, "ML-DSA-65");
    assert.strictEqual(signature.pqcSignatureHex.length, 128, "ML-DSA dual hash envelope must be 128 chars");
    assert.strictEqual(typeof signature.timestampIso, "string");

    // Verification must pass
    const verification = EosSingleExecutableDistributionGovernor.verifyBinaryArtifact(
      payload,
      signature,
      keypair.publicKeyPem,
    );
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.signatureVerified, true);
    assert.strictEqual(verification.pqcVerified, true);
  });

  it("BDD-1602: Tampered Binary Detection and Fail-Closed Guard", () => {
    const keypair = EosSingleExecutableDistributionGovernor.generateDualKeyPair();
    const payload = "Original-Unmodified-Binary-Bytes";
    const signature = EosSingleExecutableDistributionGovernor.signBinaryArtifact(payload, keypair);

    // Tamper payload byte
    const tamperedPayload = "Original-Unmodified-Binary-Bytes-Corrupted";
    const result = EosSingleExecutableDistributionGovernor.verifyBinaryArtifact(
      tamperedPayload,
      signature,
      keypair.publicKeyPem,
    );

    assert.strictEqual(result.valid, false, "Must reject tampered payload");
    assert.ok(result.error?.includes("TAMPERED_BINARY_DETECTED"), "Error must cite TAMPERED_BINARY_DETECTED");

    // Tamper signature deterministically (never a no-op when byte 0 is already 0x00)
    const sigBytes = Buffer.from(signature.signatureHex, "hex");
    sigBytes[0] ^= 0xff;
    const corruptedSig = {
      ...signature,
      signatureHex: sigBytes.toString("hex"),
    };
    assert.notStrictEqual(corruptedSig.signatureHex, signature.signatureHex, "Corrupted signature must differ");
    const sigResult = EosSingleExecutableDistributionGovernor.verifyBinaryArtifact(
      payload,
      corruptedSig,
      keypair.publicKeyPem,
    );
    assert.strictEqual(sigResult.valid, false, "Must reject invalid signature");
  });

  it("BDD-1603: Distribution Bundle Packaging and In-Toto Provenance", () => {
    const keypair = EosSingleExecutableDistributionGovernor.generateDualKeyPair();
    const payload = "Binary-Executable-Machine-Code-Bytes";
    const signature = EosSingleExecutableDistributionGovernor.signBinaryArtifact(payload, keypair);

    const bundle = EosSingleExecutableDistributionGovernor.createDistributionBundle("linux-x64", payload, signature);

    assert.strictEqual(bundle.platform, "linux-x64");
    assert.strictEqual(bundle.binaryName, "eos-linux-x64");
    assert.strictEqual(bundle.binarySize, Buffer.byteLength(payload));
    assert.strictEqual(bundle.signature, signature);

    const statement = bundle.inTotoStatement;
    assert.strictEqual(statement._type, "https://in-toto.io/Statement/v1");
    assert.strictEqual(statement.predicateType, "https://slsa.dev/provenance/v1");
  });

  it("BDD-1604: End-to-End Cryptographic SEA Audit Receipt", () => {
    const receipt = EosSingleExecutableDistributionGovernor.auditSeaDistributionPipeline({
      projectRoot: process.cwd(),
    });

    assert.strictEqual(receipt.receiptType, "EOS_SEA_BINARY_DISTRIBUTION_AUDIT");
    assert.strictEqual(receipt.specRef, "SPEC-304");
    assert.strictEqual(receipt.totalPlatforms, 5);
    assert.strictEqual(receipt.binariesVerified, 5);
    assert.strictEqual(receipt.dualSigningVerified, true);
    assert.strictEqual(typeof receipt.sha256Signature, "string");
    assert.strictEqual(receipt.sha256Signature.length, 64);

    const receiptPath = path.join(process.cwd(), "docs", "evidence", "SEA_BINARY_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath), "docs/evidence/SEA_BINARY_RECEIPT.json must exist");

    const onDisk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.strictEqual(onDisk.receiptType, "EOS_SEA_BINARY_DISTRIBUTION_AUDIT");
    assert.strictEqual(onDisk.sha256Signature, receipt.sha256Signature);
  });
});
