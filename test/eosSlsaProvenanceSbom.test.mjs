/**
 * EOS SYSTEM — SPEC-061 BDD TEST SUITE
 * SLSA Level 4 Provenance & CycloneDX v1.5 SBOM Engine
 */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EosSlsaProvenanceSbom } from "../src/core/eosSlsaProvenanceSbom.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

test("BDD-188: Deterministic CycloneDX v1.5 SBOM Generation", () => {
  const sbom = EosSlsaProvenanceSbom.generateCycloneDxSbom(process.cwd());

  assert.equal(sbom.bomFormat, "CycloneDX");
  assert.equal(sbom.specVersion, "1.5");
  assert.ok(sbom.serialNumber.startsWith("urn:uuid:"));
  assert.equal(sbom.metadata.runtimeDependenciesCount, 0); // Pure Layer 0
  assert.ok(sbom.components.length > 50, `Expected > 50 components, got ${sbom.components.length}`);

  // Verify first component structure
  const first = sbom.components[0];
  assert.equal(first.type, "file");
  assert.ok(first.name.startsWith("src/core/"));
  assert.equal(first.hashes[0].alg, "SHA-256");
  assert.equal(first.hashes[0].content.length, 64);
  assert.equal(sbom.sha256Receipt.length, 64);
});

test("BDD-189: In-Toto SLSA Provenance v1.0 Attestation", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-slsa-test-"));
  const ledgerPath = path.join(tmpDir, "ledger.sqlite");

  try {
    const slsa = EosSlsaProvenanceSbom.generateSlsaProvenance(process.cwd(), "abcdef1234567890");

    assert.equal(slsa._type, "https://in-toto.io/Statement/v1");
    assert.equal(slsa.predicateType, "https://slsa.dev/provenance/v1");
    assert.equal(slsa.subject.length >= 2, true);
    assert.equal(slsa.predicate.buildDefinition.externalParameters.runtimePurity, "LAYER_0_ZERO_NPM_DEPS");
    assert.equal(slsa.sha256Receipt.length, 64);

    // Verify Ledger persistence
    const saved = EosSlsaProvenanceSbom.recordReceiptInLedger(slsa, ledgerPath);
    assert.equal(saved, true);

    const ledger = new EosDurableSqliteLedger(ledgerPath);
    const recent = ledger.listRecent(5);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].category, "SECURITY_AUDIT");
    assert.equal(recent[0].payload.sha256Receipt, slsa.sha256Receipt);
    ledger.close();

    // Verify Ledger persistence with SBOM report
    const sbom = EosSlsaProvenanceSbom.generateCycloneDxSbom(process.cwd());
    const savedSbom = EosSlsaProvenanceSbom.recordReceiptInLedger(sbom, ledgerPath);
    assert.equal(savedSbom, true);

    const ledger2 = new EosDurableSqliteLedger(ledgerPath);
    const recent2 = ledger2.listRecent(5);
    assert.equal(recent2.length, 2);
    assert.ok(recent2[0].title.includes("CycloneDX"));
    ledger2.close();

    // Verify recordReceiptInLedger with directory path and .db path
    const savedDir = EosSlsaProvenanceSbom.recordReceiptInLedger(sbom, tmpDir);
    assert.equal(savedDir, true);

    const dbPath = path.join(tmpDir, "custom.db");
    const savedDb = EosSlsaProvenanceSbom.recordReceiptInLedger(sbom, dbPath);
    assert.equal(savedDb, true);

    // Verify catch block
    const originalAppend = EosDurableSqliteLedger.prototype.appendEntry;
    try {
      EosDurableSqliteLedger.prototype.appendEntry = () => {
        throw new Error("Disk fault simulation");
      };
      const failed = EosSlsaProvenanceSbom.recordReceiptInLedger(sbom, tmpDir);
      assert.equal(failed, false);
    } finally {
      EosDurableSqliteLedger.prototype.appendEntry = originalAppend;
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks on Windows
    }
  }
});

test("BDD-190: Provenance HEAD Resolution and SOURCE_DATE_EPOCH Determinism", () => {
  // Test with HEAD (exercises readPinnedCommitIfMaterialUnchanged & resolveGitCommit)
  const slsaHead = EosSlsaProvenanceSbom.generateSlsaProvenance(process.cwd(), "HEAD");
  assert.ok(slsaHead.predicate.buildDefinition.externalParameters.commitSha.length >= 7);

  // Test with SOURCE_DATE_EPOCH environment variable
  const origEpoch = process.env.SOURCE_DATE_EPOCH;
  try {
    process.env.SOURCE_DATE_EPOCH = "1700000000";
    const slsaEpoch = EosSlsaProvenanceSbom.generateSlsaProvenance(process.cwd(), "1234567890abcdef");
    assert.equal(slsaEpoch.predicate.runDetails.metadata.startedOn, new Date(1700000000 * 1000).toISOString());
  } finally {
    if (origEpoch !== undefined) {
      process.env.SOURCE_DATE_EPOCH = origEpoch;
    } else {
      delete process.env.SOURCE_DATE_EPOCH;
    }
  }
});

test("BDD-191: Supply Chain Verification Engine (Fail-Closed & Integrity Checks)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-supply-chain-verify-"));

  try {
    // 1. Missing files
    const missingRes = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir);
    assert.equal(missingRes.valid, false);
    assert.equal(missingRes.errors.length, 2);
    assert.ok(missingRes.errors[0].includes("CycloneDX SBOM file missing"));

    // 2. Synthesize valid SBOM & Provenance in tmpDir
    const testFile = path.join(tmpDir, "sample.js");
    fs.writeFileSync(testFile, "console.log('eos');\n", "utf8");
    const fileHash = crypto.createHash("sha256").update(fs.readFileSync(testFile)).digest("hex");

    const validSbom = {
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      serialNumber: "urn:uuid:12345678-1234-5234-8234-123456789abc",
      version: 1,
      metadata: { runtimeDependenciesCount: 0 },
      components: [
        {
          name: "sample.js",
          hashes: [{ alg: "SHA-256", content: fileHash }],
        },
      ],
    };

    const validProv = {
      _type: "https://in-toto.io/Statement/v1",
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [
        {
          name: "sample.js",
          digest: { sha256: fileHash },
        },
        {
          name: "virtual-bundle",
          digest: { sha256: fileHash },
        },
      ],
    };

    const sbomPath = path.join(tmpDir, "sbom.json");
    const provPath = path.join(tmpDir, "prov.jsonl");
    fs.writeFileSync(sbomPath, JSON.stringify(validSbom), "utf8");
    fs.writeFileSync(provPath, JSON.stringify(validProv) + "\n", "utf8");

    const verifySuccess = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, sbomPath, provPath);
    assert.equal(verifySuccess.valid, true);
    assert.equal(verifySuccess.componentsChecked, 1);
    assert.equal(verifySuccess.subjectsChecked, 2);
    assert.ok(verifySuccess.sbomDigest);
    assert.ok(verifySuccess.provenanceDigest);

    // 3. Mismatch hash in SBOM
    const tamperedSbom = {
      ...validSbom,
      components: [
        {
          name: "sample.js",
          hashes: [{ alg: "SHA-256", content: "0".repeat(64) }],
        },
      ],
    };
    fs.writeFileSync(sbomPath, JSON.stringify(tamperedSbom, null, 2), "utf8");
    const verifyMismatch = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, sbomPath, provPath);
    assert.equal(verifyMismatch.valid, false);
    assert.ok(verifyMismatch.errors.some((e) => e.includes("SHA-256 digest mismatch")));

    // 4. Invalid specVersion and bomFormat
    const badFormatSbom = {
      bomFormat: "INVALID",
      specVersion: "1.4",
      metadata: { runtimeDependenciesCount: 5 },
      components: "not-array",
    };
    fs.writeFileSync(sbomPath, JSON.stringify(badFormatSbom, null, 2), "utf8");
    const verifyBadFormat = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, sbomPath, provPath);
    assert.equal(verifyBadFormat.valid, false);
    assert.ok(verifyBadFormat.errors.some((e) => e.includes("Invalid bomFormat")));
    assert.ok(verifyBadFormat.errors.some((e) => e.includes("Invalid specVersion")));
    assert.ok(verifyBadFormat.errors.some((e) => e.includes("Layer-0 purity violation")));

    // 5. Invalid Provenance types
    const badProv = {
      _type: "INVALID_TYPE",
      predicateType: "INVALID_PRED",
      subject: "not-array",
    };
    fs.writeFileSync(provPath, JSON.stringify(badProv) + "\n", "utf8");
    const verifyBadProv = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, sbomPath, provPath);
    assert.equal(verifyBadProv.valid, false);
    assert.ok(verifyBadProv.errors.some((e) => e.includes("Invalid in-toto Statement _type")));
    assert.ok(verifyBadProv.errors.some((e) => e.includes("Invalid predicateType")));
    assert.ok(verifyBadProv.errors.some((e) => e.includes("SLSA Statement subject property is not an array")));

    // 6. JSON parse error
    fs.writeFileSync(sbomPath, "{ broken", "utf8");
    fs.writeFileSync(provPath, "{ broken", "utf8");
    const verifyParseErr = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, sbomPath, provPath);
    assert.equal(verifyParseErr.valid, false);
    assert.ok(verifyParseErr.errors.some((e) => e.includes("Failed to parse or validate SBOM")));
    assert.ok(verifyParseErr.errors.some((e) => e.includes("Failed to parse or validate SLSA")));

    // 7. Component missing on disk, missing hash entry, subject digest mismatch, and invalid virtual subject
    const edgeSbom = {
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      metadata: { runtimeDependenciesCount: 0 },
      components: [
        { name: "non_existent.js", hashes: [{ alg: "SHA-256", content: fileHash }] },
        { name: "sample.js", hashes: [{ alg: "MD5", content: "bad" }] },
      ],
    };
    const edgeProv = {
      _type: "https://in-toto.io/Statement/v1",
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [
        { name: "sample.js", digest: {} }, // missing sha256
        { name: "sample.js", digest: { sha256: "0".repeat(64) } }, // digest mismatch
        { name: "virtual-bundle", digest: { sha256: "too-short" } }, // invalid virtual subject
      ],
    };
    fs.writeFileSync(sbomPath, JSON.stringify(edgeSbom), "utf8");
    fs.writeFileSync(provPath, JSON.stringify(edgeProv) + "\n", "utf8");
    const verifyEdge = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, sbomPath, provPath);
    assert.equal(verifyEdge.valid, false);
    assert.ok(verifyEdge.errors.some((e) => e.includes("Cataloged SBOM component missing on disk")));
    assert.ok(verifyEdge.errors.some((e) => e.includes("Missing SHA-256 hash entry")));
    assert.ok(verifyEdge.errors.some((e) => e.includes("Missing sha256 digest for subject")));
    assert.ok(verifyEdge.errors.some((e) => e.includes("SLSA Subject digest mismatch")));
    assert.ok(verifyEdge.errors.some((e) => e.includes("Invalid virtual subject digest")));
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks on Windows
    }
  }
});
