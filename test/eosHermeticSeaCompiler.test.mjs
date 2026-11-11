/**
 * EOS SYSTEM — HERMETIC SEA BINARY COMPILER TEST SUITE
 * Governed by SPEC-198, CHANGE-083, ADR-083, BDD-1009..BDD-1013 (v68.0.0)
 *
 * Validates deterministic Single Executable Application binary compilation,
 * Ed25519 digital signatures, and SLSA Level-4 supply-chain provenance.
 * Pure JavaScript for native Node.js test runner (zero external dependencies).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EosHermeticSeaCompiler } from "../src/core/eosHermeticSeaCompiler.ts";

describe("EosHermeticSeaCompiler (SPEC-198 / BDD-1009..BDD-1013)", () => {
  const testOutputDir = path.resolve(process.cwd(), "dist/test-sea");

  it("BDD-1009: Declarative SEA config and blob generation", () => {
    // 1. Generate declarative sea-config.json
    const { configPath, config } = EosHermeticSeaCompiler.generateSeaConfig({
      outputDir: testOutputDir,
      disableWarning: true,
    });

    assert.ok(fs.existsSync(configPath));
    assert.equal(config.disableExperimentalSEAWarning, true);
    assert.ok(config.main.replace(/\\/g, "/").endsWith("bin/sea-bootstrap.cjs"));
    assert.ok(config.output.replace(/\\/g, "/").endsWith("dist/test-sea/glorian.blob"));

    // 2. Compile SEA blob
    const blobResult = EosHermeticSeaCompiler.compileBlob({
      configPath,
      outputDir: testOutputDir,
    });

    assert.ok(fs.existsSync(blobResult.blobPath));
    assert.ok(blobResult.blobBytes > 0);
    assert.equal(blobResult.sha256.length, 64);
    assert.equal(/^[0-9a-f]{64}$/.test(blobResult.sha256), true);
  });

  it("BDD-1010: Standalone native executable synthesis (dry-run & active mode)", () => {
    // 1. Dry-run synthesis
    const dryResult = EosHermeticSeaCompiler.compileStandaloneBinary({
      outputDir: testOutputDir,
      dryRun: true,
      targetPlatform: "linux-x64",
    });

    assert.equal(dryResult.success, true);
    assert.equal(dryResult.dryRun, true);
    assert.equal(dryResult.targetPlatform, "linux-x64");
    assert.ok(dryResult.binaryPath.endsWith("glorian-linux-x64"));
    assert.ok(dryResult.binarySizeBytes > 0);
    assert.equal(dryResult.sha256.length, 64);
    assert.equal(dryResult.sha256Receipt.length, 64);

    // 2. Active mode synthesis (cloning runtime & permissions)
    const activeResult = EosHermeticSeaCompiler.compileStandaloneBinary({
      outputDir: testOutputDir,
      dryRun: false,
      targetPlatform: "test-platform",
    });

    assert.equal(activeResult.success, true);
    assert.equal(activeResult.dryRun, false);
    assert.ok(fs.existsSync(activeResult.binaryPath));
    assert.ok(activeResult.binarySizeBytes > 10 * 1024 * 1024, "Binary must exceed 10MB");
    assert.equal(activeResult.sha256.length, 64);

    // Verify file permissions (0o755)
    const stats = fs.statSync(activeResult.binaryPath);
    // On POSIX, executable bit should be present (Windows NTFS does not support POSIX mode bits)
    if (process.platform !== "win32") {
      assert.ok((stats.mode & 0o111) !== 0, "Binary must be executable");
    } else {
      assert.ok(stats.size > 0, "Binary must exist and have non-zero size");
    }

    // Clean up large test binary to conserve disk space
    try {
      fs.unlinkSync(activeResult.binaryPath);
    } catch {
      // ignore
    }
  });

  it("BDD-1011: Ed25519 digital signature sealing and verification", () => {
    // Create a deterministic dummy binary to sign
    const dummyBinary = path.join(testOutputDir, "glorian-sign-test");
    fs.mkdirSync(testOutputDir, { recursive: true });
    fs.writeFileSync(dummyBinary, "HERMETIC_GLORIAN_SIGNED_PAYLOAD_TEST");

    const sigResult = EosHermeticSeaCompiler.signBinary(dummyBinary);
    assert.ok(fs.existsSync(sigResult.signaturePath));
    assert.ok(sigResult.signatureHex.length > 0);
    assert.ok(sigResult.publicKeyPem.includes("BEGIN PUBLIC KEY"));

    // Verify valid signature
    const isValid = EosHermeticSeaCompiler.verifyBinarySignature(
      dummyBinary,
      sigResult.signatureHex,
      sigResult.publicKeyPem,
    );
    assert.equal(isValid, true);

    // Tamper with binary content and verify rejection
    fs.appendFileSync(dummyBinary, "_TAMPERED");
    const isTamperedValid = EosHermeticSeaCompiler.verifyBinarySignature(
      dummyBinary,
      sigResult.signatureHex,
      sigResult.publicKeyPem,
    );
    assert.equal(isTamperedValid, false);
  });

  it("BDD-1012: SLSA Level-4 Provenance and CycloneDX SBOM generation", () => {
    const compileResult = EosHermeticSeaCompiler.compileStandaloneBinary({
      outputDir: testOutputDir,
      dryRun: true,
      targetPlatform: "darwin-arm64",
    });

    // Check provenance
    assert.ok(compileResult.provenancePath);
    assert.ok(fs.existsSync(compileResult.provenancePath));
    assert.equal(compileResult.provenance._type, "https://in-toto.io/Statement/v1");
    assert.equal(compileResult.provenance.predicateType, "https://slsa.dev/provenance/v1");
    assert.equal(compileResult.provenance.subject[0].name, "glorian-darwin-arm64");
    assert.equal(compileResult.provenance.subject[0].digest.sha256, compileResult.sha256);

    // Check CycloneDX SBOM
    assert.ok(compileResult.sbomPath);
    assert.ok(fs.existsSync(compileResult.sbomPath));
    assert.equal(compileResult.sbom.bomFormat, "CycloneDX");
    assert.equal(compileResult.sbom.specVersion, "1.5");
    assert.equal(compileResult.sbom.components.length >= 2, true);
  });

  it("BDD-1013: End-to-end CLI invocation (compile --dry-run --json)", () => {
    const rawOutput = execFileSync(process.execPath, ["bin/eos.mjs", "compile", "--dry-run", "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    const parsed = JSON.parse(rawOutput.trim());
    assert.equal(parsed.success, true);
    assert.equal(parsed.dryRun, true);
    assert.ok(typeof parsed.binarySizeBytes === "number");
    assert.equal(parsed.sha256.length, 64);
    assert.equal(parsed.sha256Receipt.length, 64);
    assert.ok(parsed.provenancePath.endsWith(".provenance.json"));
    assert.ok(parsed.sbomPath.endsWith(".sbom.json"));
  });
});
