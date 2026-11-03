/**
 * EOS SYSTEM — SPEC-139 BDD TEST SUITE
 * SLSA Level 3 Supply Chain Attestation & CycloneDX v1.5 Verification
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { EosSlsaProvenanceSbom } from "../src/core/eosSlsaProvenanceSbom.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-369: Deterministic Generation & Congruence of CycloneDX v1.5 SBOM & In-Toto SLSA Provenance", () => {
  // 1. Run generator script
  const genScript = path.join(projectRoot, "scripts", "eos-generate-sbom.mjs");
  assert.ok(fs.existsSync(genScript), "scripts/eos-generate-sbom.mjs must exist");

  execFileSync(process.execPath, [genScript], {
    cwd: projectRoot,
    stdio: "pipe"
  });

  const sbomPath = path.join(projectRoot, "docs", "evidence", "sbom.cdx.json");
  const provPath = path.join(projectRoot, "docs", "evidence", "provenance.intoto.jsonl");

  assert.ok(fs.existsSync(sbomPath), "docs/evidence/sbom.cdx.json must exist");
  assert.ok(fs.existsSync(provPath), "docs/evidence/provenance.intoto.jsonl must exist");

  // 2. Validate CycloneDX v1.5 specification
  const sbom = JSON.parse(fs.readFileSync(sbomPath, "utf8"));
  assert.equal(sbom.bomFormat, "CycloneDX");
  assert.equal(sbom.specVersion, "1.5");
  assert.equal(sbom.metadata.runtimeDependenciesCount, 0, "Layer 0 mandates 0 runtime dependencies");
  assert.ok(sbom.components.length >= 100, `Expected >= 100 components, got ${sbom.components.length}`);

  // 3. Validate In-Toto Statement v1 with SLSA Provenance v1.0
  const provRaw = fs.readFileSync(provPath, "utf8").trim();
  const statement = JSON.parse(provRaw.split(/\r?\n/)[0]);
  assert.equal(statement._type, "https://in-toto.io/Statement/v1");
  assert.equal(statement.predicateType, "https://slsa.dev/provenance/v1");
  assert.ok(statement.subject.length >= 3, "Must attest at least 3 core entrypoint artifacts");
  assert.equal(statement.predicate.buildDefinition.externalParameters.runtimePurity, "LAYER_0_ZERO_NPM_DEPS");

  // 4. Verify bit-for-bit supply chain verification
  const verification = EosSlsaProvenanceSbom.verifySupplyChain(projectRoot, sbomPath, provPath);
  assert.equal(verification.valid, true, `Verification failed with errors: ${verification.errors.join(", ")}`);
  assert.equal(verification.errors.length, 0);
  assert.ok(verification.componentsChecked >= 100);
  assert.ok(verification.subjectsChecked >= 3);
});

test("BDD-370: Adversarial Fail-Closed Rejection of Tampered Artifacts and Manifests", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-slsa-adversarial-"));

  try {
    // Scaffold minimal isolated mock repository
    const mockFileRel = "src/core/eosMockTarget.ts";
    const mockFileAbs = path.join(tmpDir, mockFileRel);
    fs.mkdirSync(path.dirname(mockFileAbs), { recursive: true });
    fs.writeFileSync(mockFileAbs, "export const mock = 42;\n", "utf8");

    const validHash = crypto.createHash("sha256").update(fs.readFileSync(mockFileAbs)).digest("hex");

    const validSbom = {
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      serialNumber: "urn:uuid:00000000-0000-0000-0000-000000000000",
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        component: {
          type: "application",
          name: "glorian-mock",
          version: "1.0.0",
          hashes: [{ alg: "SHA-256", content: validHash }]
        },
        tools: [{ name: "EOS-SecDevOps-Sbom-Engine", version: "1.0.0" }],
        runtimeDependenciesCount: 0
      },
      components: [
        {
          type: "file",
          name: mockFileRel,
          version: "1.0.0",
          hashes: [{ alg: "SHA-256", content: validHash }]
        }
      ],
      sha256Receipt: validHash
    };

    const validProvenance = {
      _type: "https://in-toto.io/Statement/v1",
      subject: [
        {
          name: mockFileRel,
          digest: { sha256: validHash }
        }
      ],
      predicateType: "https://slsa.dev/provenance/v1",
      predicate: {
        buildDefinition: {
          buildType: "https://eos.dev/builders/layer0/v1",
          externalParameters: { runtimePurity: "LAYER_0_ZERO_NPM_DEPS" },
          internalParameters: {},
          resolvedDependencies: []
        },
        runDetails: {
          builder: { id: "test-builder", version: "1.0.0" },
          metadata: { invocationId: "inv-1", startedOn: new Date().toISOString(), finishedOn: new Date().toISOString() }
        }
      },
      sha256Receipt: validHash
    };

    const mockSbomPath = path.join(tmpDir, "sbom.cdx.json");
    const mockProvPath = path.join(tmpDir, "provenance.intoto.jsonl");

    // Case 1: Pristine state passes
    fs.writeFileSync(mockSbomPath, JSON.stringify(validSbom, null, 2), "utf8");
    fs.writeFileSync(mockProvPath, JSON.stringify(validProvenance), "utf8");

    const pristineRes = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, mockSbomPath, mockProvPath);
    assert.equal(pristineRes.valid, true);

    // Case 2: Tampered file content on disk fails closed
    fs.writeFileSync(mockFileAbs, "export const mock = 'MALICIOUS_INJECTION';\n", "utf8");
    const tamperedRes = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, mockSbomPath, mockProvPath);
    assert.equal(tamperedRes.valid, false);
    assert.ok(tamperedRes.errors.some((e) => e.includes("SHA-256 digest mismatch")));

    // Revert file
    fs.writeFileSync(mockFileAbs, "export const mock = 42;\n", "utf8");

    // Case 3: Tampered SBOM hash fails closed
    const corruptedSbom = JSON.parse(JSON.stringify(validSbom));
    corruptedSbom.components[0].hashes[0].content = "0000000000000000000000000000000000000000000000000000000000000000";
    fs.writeFileSync(mockSbomPath, JSON.stringify(corruptedSbom, null, 2), "utf8");
    const sbomCorruptRes = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, mockSbomPath, mockProvPath);
    assert.equal(sbomCorruptRes.valid, false);
    assert.ok(sbomCorruptRes.errors.some((e) => e.includes("SHA-256 digest mismatch")));

    // Case 4: Non-zero runtime dependencies in SBOM fails closed
    const impureSbom = JSON.parse(JSON.stringify(validSbom));
    impureSbom.metadata.runtimeDependenciesCount = 1;
    fs.writeFileSync(mockSbomPath, JSON.stringify(impureSbom, null, 2), "utf8");
    const impureRes = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, mockSbomPath, mockProvPath);
    assert.equal(impureRes.valid, false);
    assert.ok(impureRes.errors.some((e) => e.includes("Layer-0 purity violation")));

    // Case 5: Missing manifest file fails closed
    fs.rmSync(mockSbomPath, { force: true });
    const missingRes = EosSlsaProvenanceSbom.verifySupplyChain(tmpDir, mockSbomPath, mockProvPath);
    assert.equal(missingRes.valid, false);
    assert.ok(missingRes.errors.some((e) => e.includes("file missing")));
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks on Windows
    }
  }
});

test("BDD-371: CI/CD Sovereign Supply Chain Attestation Job Configuration", () => {
  const workflowPath = path.join(projectRoot, ".github", "workflows", "eos-sovereign-cicd.yml");
  assert.ok(fs.existsSync(workflowPath), ".github/workflows/eos-sovereign-cicd.yml must exist");

  const content = fs.readFileSync(workflowPath, "utf8");

  // 1. Verify job definition
  assert.ok(content.includes("supply-chain-attestation:"), "Workflow must define supply-chain-attestation job");

  // 2. Verify strict OIDC permissions
  assert.ok(content.includes("id-token: write"), "Job must request id-token: write permission for keyless OIDC");
  assert.ok(content.includes("attestations: write"), "Job must request attestations: write permission for GitHub attestations");

  // 3. Verify event isolation to main branch push
  assert.ok(
    content.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/main'"),
    "Job must be restricted exclusively to push events on refs/heads/main to isolate fork PRs"
  );

  // 4. Verify invocation of L0 scripts
  assert.ok(content.includes("node scripts/eos-generate-sbom.mjs"), "Job must invoke eos-generate-sbom.mjs");
  assert.ok(content.includes("node scripts/verify-supply-chain.mjs"), "Job must invoke verify-supply-chain.mjs");
});
