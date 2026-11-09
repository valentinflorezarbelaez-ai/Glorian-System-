/**
 * EOS SYSTEM — SPEC-061 BDD TEST SUITE
 * SLSA Level 4 Provenance & CycloneDX v1.5 SBOM Engine
 */

import test from "node:test";
import assert from "node:assert/strict";
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
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks on Windows
    }
  }
});
