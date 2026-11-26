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
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
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

    // 2. Active mode synthesis (cloning runtime, postject CLI hook & permissions)
    const fastInjectorStub = path.join(testOutputDir, "postject-stub.cjs");
    fs.mkdirSync(testOutputDir, { recursive: true });
    fs.writeFileSync(fastInjectorStub, "process.exit(0);\n", "utf8");

    const activeResult = EosHermeticSeaCompiler.compileStandaloneBinary({
      outputDir: testOutputDir,
      dryRun: false,
      postjectCliPath: fastInjectorStub,
    });

    assert.equal(activeResult.success, true);
    assert.equal(activeResult.dryRun, false);
    assert.equal(activeResult.blobInjected, true, "postject CLI hook must inject SEA blob");
    assert.ok(fs.existsSync(activeResult.binaryPath));
    assert.ok(activeResult.binarySizeBytes > 10 * 1024 * 1024, "Binary must exceed 10MB");
    assert.equal(activeResult.sha256.length, 64);

    const fallbackResult = EosHermeticSeaCompiler.compileStandaloneBinary({
      outputDir: testOutputDir,
      dryRun: false,
      targetPlatform: "fallback-check",
      postjectCliPath: path.join(testOutputDir, "missing-postject.cjs"),
    });
    assert.equal(typeof fallbackResult.blobInjected, "boolean");
    try {
      fs.unlinkSync(fallbackResult.binaryPath);
    } catch {
      // ignore
    }

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

  it("BDD-1014: CLI SEA release bundle synthesis emits SHA256SUMS.txt without mutating root sea-config.json", () => {
    const root = process.cwd();
    const rootConfigBefore = fs.readFileSync(path.join(root, "sea-config.json"), "utf8");
    const output = execFileSync(process.execPath, ["scripts/build-sea-binary.mjs", "--bundle-release", "--dry-run"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /\[SEA BUNDLE\] SHA256SUMS:/);
    const rootConfigAfter = fs.readFileSync(path.join(root, "sea-config.json"), "utf8");
    assert.equal(rootConfigAfter, rootConfigBefore, "Root sea-config.json must stay unchanged");

    const checksumPath = path.join(root, "dist", "SHA256SUMS.txt");
    assert.ok(fs.existsSync(checksumPath), "dist/SHA256SUMS.txt must be emitted");
    const lines = fs.readFileSync(checksumPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length >= 4, "SHA256SUMS.txt must index eos.blob and generated release metadata");
    for (const line of lines) {
      assert.match(line, /^[0-9a-f]{64} {2}\S+$/);
    }
  });

  it("BDD-1015: covers custom paths, fallback blob compilation, pre-supplied Ed25519 keys, and platform branches", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sea-branches-"));
    try {
      const freshOutDir = path.join(tmpDir, "fresh-out");
      const customEntry = path.join(tmpDir, "custom-entry.cjs");
      const customCfg = path.join(tmpDir, "custom-sea.json");
      fs.writeFileSync(customEntry, "console.log('CUSTOM_SEA_ENTRY');\n", "utf8");

      // 1. Fresh outDir mkdir + customEntryPath + customConfigPath + disableWarning=false
      const cfgRes = EosHermeticSeaCompiler.generateHermeticSeaConfig({
        outputDir: freshOutDir,
        customEntryPath: customEntry,
        customConfigPath: customCfg,
        disableWarning: false,
      });
      assert.equal(cfgRes.config.disableExperimentalSEAWarning, false);
      assert.equal(cfgRes.configPath, customCfg);

      // 2. compileBlob auto-generates config when omitted (default bin/sea-bootstrap.cjs)
      const autoBlob = EosHermeticSeaCompiler.compileBlob({
        outputDir: freshOutDir,
      });
      assert.ok(autoBlob.blobBytes > 0);

      // 3. compileBlob catch fallback when invalid SEA config points to existing main script
      const badSchemaWithMain = path.join(tmpDir, "bad-schema-with-main.json");
      const fallbackBlobA = path.join(freshOutDir, "fallback-a.blob");
      fs.writeFileSync(
        badSchemaWithMain,
        JSON.stringify({ main: customEntry, output: fallbackBlobA, assets: "invalid-not-object" }),
        "utf8",
      );
      const fbResA = EosHermeticSeaCompiler.compileBlob({ configPath: badSchemaWithMain });
      assert.ok(fs.readFileSync(fbResA.blobPath, "utf8").includes("CUSTOM_SEA_ENTRY"));
      // Re-run while blobTarget already exists (if (!fs.existsSync(blobTarget)) false branch)
      const fbResAExisting = EosHermeticSeaCompiler.compileBlob({ configPath: badSchemaWithMain });
      assert.equal(fbResAExisting.sha256, fbResA.sha256);

      // 4. compileBlob catch fallback when main script does not exist on disk
      const badSchemaNoMain = path.join(tmpDir, "bad-schema-no-main.json");
      const fallbackBlobB = path.join(freshOutDir, "fallback-b.blob");
      fs.writeFileSync(
        badSchemaNoMain,
        JSON.stringify({ main: path.join(tmpDir, "does-not-exist.cjs"), output: fallbackBlobB }),
        "utf8",
      );
      const fbResB = EosHermeticSeaCompiler.compileBlob({ configPath: badSchemaNoMain });
      assert.ok(fs.readFileSync(fbResB.blobPath, "utf8").includes("NODE_SEA_BLOB_V1"));

      // 5. signBinary with pre-supplied Ed25519 keys, partial keys, and verifyBinarySignature failure branches
      const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      const dummyPayload = path.join(tmpDir, "dummy.bin");
      fs.writeFileSync(dummyPayload, "BINARY_PAYLOAD", "utf8");
      const explicitSig = EosHermeticSeaCompiler.signBinary(dummyPayload, {
        privateKeyPem: privateKey,
        publicKeyPem: publicKey,
      });
      assert.equal(
        EosHermeticSeaCompiler.verifyBinarySignature(dummyPayload, explicitSig.signatureHex, publicKey),
        true,
      );
      assert.equal(
        EosHermeticSeaCompiler.verifyBinarySignature(
          path.join(tmpDir, "missing.bin"),
          explicitSig.signatureHex,
          publicKey,
        ),
        false,
      );
      assert.equal(
        EosHermeticSeaCompiler.verifyBinarySignature(dummyPayload, explicitSig.signatureHex, "BAD_PEM"),
        false,
      );
      const partialKeySig = EosHermeticSeaCompiler.signBinary(dummyPayload, { privateKeyPem: privateKey });
      assert.ok(partialKeySig.signatureHex.length > 0);

      // 6. compileStandaloneBinary dryRun with fresh outDir, "windows-x64", sign=false, custom builderId
      const nestedDryOut = path.join(tmpDir, "nested-dry-out");
      const unsignedDry = EosHermeticSeaCompiler.compileStandaloneBinary({
        outputDir: nestedDryOut,
        dryRun: true,
        targetPlatform: "windows-x64",
        sign: false,
        builderId: "https://eos.engineer/builders/custom",
      });
      assert.equal(unsignedDry.signatureHex, undefined);
      assert.ok(unsignedDry.binaryPath.endsWith(".exe"));
      assert.equal(unsignedDry.blobInjected, false);

      // 7. compileStandaloneBinary active mode: darwin-arm64 (--macho-segment-name) + failing stub catch + temp projectRoot localPostjectCli
      const stubRoot = path.join(tmpDir, "stub-root");
      fs.mkdirSync(path.join(stubRoot, "bin"), { recursive: true });
      fs.mkdirSync(path.join(stubRoot, "node_modules", "postject", "dist"), { recursive: true });
      fs.writeFileSync(path.join(stubRoot, "bin", "sea-bootstrap.cjs"), "console.log('BOOT');\n", "utf8");
      fs.writeFileSync(path.join(stubRoot, "node_modules", "postject", "dist", "cli.js"), "process.exit(0);\n", "utf8");
      const failStub = path.join(tmpDir, "fail-postject.cjs");
      fs.writeFileSync(failStub, "process.exit(1);\n", "utf8");

      const darwinRes = EosHermeticSeaCompiler.compileStandaloneBinary({
        projectRoot: stubRoot,
        outputDir: path.join(stubRoot, "out-darwin"),
        targetPlatform: "darwin-arm64",
        dryRun: false,
        sign: false,
      });
      assert.equal(darwinRes.blobInjected, true);
      fs.unlinkSync(darwinRes.binaryPath);

      const failInjectRes = EosHermeticSeaCompiler.compileStandaloneBinary({
        projectRoot: stubRoot,
        outputDir: path.join(stubRoot, "out-fail"),
        targetPlatform: "linux-arm64",
        dryRun: false,
        sign: false,
        postjectCliPath: failStub,
      });
      assert.equal(failInjectRes.blobInjected, false);
      fs.unlinkSync(failInjectRes.binaryPath);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
