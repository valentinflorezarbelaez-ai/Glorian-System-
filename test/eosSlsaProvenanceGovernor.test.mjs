/**
 * BDD Test Suite for SPEC-293 / CHANGE-155:
 * SLSA Level 3/4 Attestations, In-Toto Provenance & Cryptographic SBOM Governor
 *
 * Verifies BDD-1533..BDD-1538.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import {
  EosSbomGenerator,
  EosSlsaAttestor,
  EosDsseSigner,
  evaluateSlsaLevel,
  auditProvenancePipeline,
} from "../src/core/eosSlsaProvenanceGovernor.ts";

describe("SPEC-293: SLSA Level 3/4 Attestations, In-Toto Provenance & Cryptographic SBOM", () => {
  // BDD-1533
  test("BDD-1533: CycloneDX v1.5 and SPDX 2.3 SBOM Generation", () => {
    const components = [
      {
        name: "src/core/eosKernelPrimitives.ts",
        version: "80.0.0",
        type: "file",
        sha256: EosSbomGenerator.computeSha256("export const x = 1;"),
        license: "Apache-2.0",
      },
      {
        name: "package.json",
        version: "80.0.0",
        type: "application",
        sha256: EosSbomGenerator.computeSha256('{"name":"glorian"}'),
        license: "Apache-2.0",
      },
    ];

    const cdx = EosSbomGenerator.generateCycloneDx(components);
    assert.equal(cdx.bomFormat, "CycloneDX");
    assert.equal(cdx.specVersion, "1.5");
    assert.ok(cdx.serialNumber.startsWith("urn:uuid:"));
    assert.equal(cdx.components.length, 2);
    assert.equal(cdx.components[0].sha256, components[0].sha256);

    const spdx = EosSbomGenerator.generateSpdx(components, "TestDoc");
    assert.equal(spdx.spdxVersion, "SPDX-2.3");
    assert.equal(spdx.dataLicense, "CC0-1.0");
    assert.equal(spdx.SPDXID, "SPDXRef-DOCUMENT");
    assert.equal(spdx.packages.length, 2);
    assert.equal(spdx.packages[0].checksums[0].checksumValue, components[0].sha256);
  });

  // BDD-1534
  test("BDD-1534: In-Toto v1 Statement and SLSA v1.0 Provenance Predicate Assembly", () => {
    const subjects = [
      {
        name: "eos-core-bundle",
        digest: { sha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" },
      },
    ];

    const statement = EosSlsaAttestor.buildProvenanceStatement({
      subjects,
      builderId: "https://glorian.system/builders/test",
      externalParameters: {
        sourceRepo: "https://github.com/valentinflorezarbelaez-ai/Glorian-System",
        commitHash: "1234567890abcdef",
      },
      internalParameters: {
        isolatedEnvironment: true,
      },
    });

    assert.equal(statement._type, "https://in-toto.io/Statement/v1");
    assert.equal(statement.predicateType, "https://slsa.dev/provenance/v1");
    assert.equal(statement.subject.length, 1);
    assert.equal(statement.subject[0].name, "eos-core-bundle");
    assert.equal(statement.predicate.runDetails.builder.id, "https://glorian.system/builders/test");
    assert.ok(statement.predicate.runDetails.metadata.startedOn);
  });

  // BDD-1535
  test("BDD-1535: DSSE Envelope Encoding and Ed25519 Signing", () => {
    const { publicKey, privateKey, keyid } = EosDsseSigner.generateKeyPair();
    assert.ok(publicKey.includes("BEGIN PUBLIC KEY"));
    assert.ok(privateKey.includes("BEGIN PRIVATE KEY"));
    assert.equal(keyid.length, 16);

    const statement = EosSlsaAttestor.buildProvenanceStatement({
      subjects: [{ name: "artifact-1", digest: { sha256: "11111111111111111111111111111111" } }],
    });

    const envelope = EosDsseSigner.signStatement(statement, privateKey, keyid);
    assert.equal(envelope.payloadType, "application/vnd.in-toto+json");
    assert.ok(envelope.payload.length > 0);
    assert.equal(envelope.signatures.length, 1);
    assert.equal(envelope.signatures[0].keyid, keyid);
    assert.ok(envelope.signatures[0].sig.length > 0);
  });

  // BDD-1536
  test("BDD-1536: DSSE Signature Verification and Tamper Detection", () => {
    const { publicKey, privateKey, keyid } = EosDsseSigner.generateKeyPair();
    const statement = EosSlsaAttestor.buildProvenanceStatement({
      subjects: [{ name: "tamper-test-target", digest: { sha256: "22222222222222222222222222222222" } }],
    });

    const envelope = EosDsseSigner.signStatement(statement, privateKey, keyid);

    // 1. Verify authentic envelope passes
    const validResult = EosDsseSigner.verifyEnvelope(envelope, publicKey);
    assert.equal(validResult.verified, true);
    assert.equal(validResult.statement?._type, "https://in-toto.io/Statement/v1");

    // 2. Tampered payload fails fail-closed
    const tamperedPayload = Buffer.from(JSON.stringify({ ...statement, subject: [] })).toString("base64");
    const tamperedEnvelope = {
      ...envelope,
      payload: tamperedPayload,
    };
    const tamperedResult = EosDsseSigner.verifyEnvelope(tamperedEnvelope, publicKey);
    assert.equal(tamperedResult.verified, false);
    assert.equal(tamperedResult.error, "SIGNATURE_VERIFICATION_FAILED");

    // 3. Different key fails
    const anotherKey = EosDsseSigner.generateKeyPair();
    const wrongKeyResult = EosDsseSigner.verifyEnvelope(envelope, anotherKey.publicKey);
    assert.equal(wrongKeyResult.verified, false);
  });

  // BDD-1537
  test("BDD-1537: SLSA Level Classification and Supply Chain Policy Verification", () => {
    const { publicKey, privateKey, keyid } = EosDsseSigner.generateKeyPair();
    assert.ok(publicKey);
    const statement = EosSlsaAttestor.buildProvenanceStatement({
      subjects: [{ name: "level3-artifact", digest: { sha256: "33333333333333333333333333333333" } }],
      builderId: "https://glorian.system/builder/isolated",
      externalParameters: {
        sourceRepo: "https://github.com/valentinflorezarbelaez-ai/Glorian-System",
        commitHash: "feedbeefcafed00d",
      },
      internalParameters: {
        isolatedEnvironment: true,
      },
      resolvedDependencies: [{ uri: "pkg:npm/node@22.18.0", digest: { sha256: "44444444444444444444444444444444" } }],
    });

    const envelope = EosDsseSigner.signStatement(statement, privateKey, keyid);
    const evalRes = evaluateSlsaLevel(statement, envelope);

    assert.equal(evalRes.slsaLevel, "SLSA_LEVEL_3");
    assert.equal(evalRes.isCompliant, true);
    assert.ok(evalRes.verifiedChecks.includes("ISOLATED_BUILD_ENVIRONMENT_VERIFIED"));
    assert.ok(evalRes.verifiedChecks.includes("SOURCE_COMMIT_TRACEABILITY_CONFIRMED"));
    assert.ok(evalRes.verifiedChecks.includes("DSSE_AUTHENTICATED_SIGNATURE_PRESENT"));
  });

  // BDD-1538
  test("BDD-1538: Cryptographic SLSA Provenance Receipt Generation", () => {
    const receipt = auditProvenancePipeline(process.cwd());

    assert.equal(receipt.specRef, "SPEC-293");
    assert.ok(receipt.totalArtifactsAttested > 0);
    assert.ok(receipt.sbomComponentsCount > 0);
    assert.equal(receipt.slsaLevelAchieved, "SLSA_LEVEL_3");
    assert.equal(receipt.envelopeSignatureValid, true);
    assert.equal(receipt.sha256Signature.length, 64);

    const receiptFilePath = resolveEvidencePath("SLSA_PROVENANCE_RECEIPT.json");
    assert.ok(fs.existsSync(receiptFilePath));
    const saved = JSON.parse(fs.readFileSync(receiptFilePath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });

  test("covers SBOM defaults, directory scanning limits, malformed DSSE envelopes, and SLSA downgrade paths", () => {
    // 1. CycloneDX & SPDX explicit/fallback fields
    const cdxCustom = EosSbomGenerator.generateCycloneDx(
      [
        {
          name: "minimal-lib",
          version: "2.0.0",
          purl: "pkg:generic/minimal-lib@2.0.0",
          type: "library",
          sha256: "aaaa",
        },
      ],
      "custom-root",
      "1.2.3",
    );
    assert.equal(cdxCustom.metadata.component.name, "custom-root");
    assert.equal(cdxCustom.metadata.component.version, "1.2.3");
    assert.equal(cdxCustom.components[0].purl, "pkg:generic/minimal-lib@2.0.0");
    assert.equal(cdxCustom.components[0].license, "Apache-2.0");

    const spdxDefault = EosSbomGenerator.generateSpdx([
      { name: "minimal-lib", version: "2.0.0", type: "library", sha256: "aaaa" },
    ]);
    assert.equal(spdxDefault.name, "Glorian-System-SBOM");
    assert.equal(spdxDefault.packages[0].licenseDeclared, "Apache-2.0");

    // 2. scanDirectoryFiles missing path, ignored dirs/extensions, and maxFiles cap
    assert.deepEqual(EosSbomGenerator.scanDirectoryFiles(path.join(os.tmpdir(), "nonexistent-slsa-dir-xyz")), []);

    const scanDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-slsa-scan-"));
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-slsa-empty-"));
    const prevEvidenceDir = process.env.EOS_EVIDENCE_DIR;
    try {
      fs.mkdirSync(path.join(scanDir, ".git"));
      fs.writeFileSync(path.join(scanDir, ".git", "config.json"), "{}", "utf8");
      fs.mkdirSync(path.join(scanDir, "node_modules"));
      fs.writeFileSync(path.join(scanDir, "node_modules", "dep.js"), "export {};", "utf8");
      fs.mkdirSync(path.join(scanDir, "sub1"));
      fs.writeFileSync(path.join(scanDir, "sub1", "keep.ts"), "export const a = 1;", "utf8");
      fs.writeFileSync(path.join(scanDir, "sub1", "skip.txt"), "ignored", "utf8");
      fs.mkdirSync(path.join(scanDir, "sub2"));
      fs.writeFileSync(path.join(scanDir, "sub2", "second.json"), "{}", "utf8");
      fs.writeFileSync(path.join(scanDir, "sub2", "third.mjs"), "export default 3;", "utf8");

      const capped = EosSbomGenerator.scanDirectoryFiles(scanDir, [".ts", ".json", ".mjs"], 1);
      assert.equal(capped.length, 1);

      const defaultScanned = EosSbomGenerator.scanDirectoryFiles(scanDir);
      assert.equal(defaultScanned.length, 3);

      // Empty workspace fallback & fresh docs/evidence creation
      delete process.env.EOS_EVIDENCE_DIR;
      const emptyReceipt = auditProvenancePipeline(emptyDir);
      assert.equal(emptyReceipt.sbomComponentsCount, 1);
      assert.equal(emptyReceipt.totalArtifactsAttested, 1);
      assert.ok(fs.existsSync(path.join(emptyDir, "docs", "evidence", "SLSA_PROVENANCE_RECEIPT.json")));
    } finally {
      if (prevEvidenceDir !== undefined) {
        process.env.EOS_EVIDENCE_DIR = prevEvidenceDir;
      }
      fs.rmSync(scanDir, { recursive: true, force: true });
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }

    // Default auditProvenancePipeline() arg with hermetic EOS_EVIDENCE_DIR
    const defaultReceipt = auditProvenancePipeline();
    assert.equal(defaultReceipt.specRef, "SPEC-293");

    // 3. Attestor optional fields & empty subjects fallback
    const fullStatement = EosSlsaAttestor.buildProvenanceStatement({
      subjects: [],
      buildType: "https://glorian.system/custom-build",
      builderVersion: "81.0.0",
      invocationId: "inv-custom",
      startedOn: "2026-01-01T00:00:00Z",
      finishedOn: "2026-01-01T00:01:00Z",
      byproducts: [{ name: "log.txt", digest: { sha256: "bbbb" } }],
    });
    assert.equal(fullStatement.predicate.buildDefinition.externalParameters.targetArtifact, "eos-system-dist");
    assert.equal(fullStatement.predicate.runDetails.byproducts.length, 1);

    // 4. Malformed envelope & exception verification paths
    const { publicKey, privateKey, keyid } = EosDsseSigner.generateKeyPair();
    assert.equal(
      EosDsseSigner.verifyEnvelope({ payload: "", payloadType: "t", signatures: [] }, publicKey).error,
      "MALFORMED_ENVELOPE",
    );
    assert.equal(
      EosDsseSigner.verifyEnvelope(
        { payload: "e30=", payloadType: "", signatures: [{ keyid, sig: "AA==" }] },
        publicKey,
      ).error,
      "MALFORMED_ENVELOPE",
    );
    assert.equal(
      EosDsseSigner.verifyEnvelope({ payload: "e30=", payloadType: "t", signatures: [] }, publicKey).error,
      "MALFORMED_ENVELOPE",
    );

    const validStmt = EosSlsaAttestor.buildProvenanceStatement({
      subjects: [{ name: "a.bin", digest: { sha256: "1234" } }],
    });
    const signedEnv = EosDsseSigner.signStatement(validStmt, privateKey, keyid);
    const badPemRes = EosDsseSigner.verifyEnvelope(signedEnv, "NOT-A-VALID-PEM");
    assert.equal(badPemRes.verified, false);
    assert.ok(badPemRes.error?.startsWith("VERIFICATION_EXCEPTION:"));

    // 5. evaluateSlsaLevel violations & level 1/2 branches
    const invalidStmtEval = evaluateSlsaLevel({
      _type: "https://wrong.type/v0",
      subject: [{ name: "no-digest", digest: {} }],
      predicateType: "https://slsa.dev/provenance/v1",
      predicate: {},
    });
    assert.equal(invalidStmtEval.isCompliant, false);
    assert.ok(invalidStmtEval.violations.includes("INVALID_STATEMENT_TYPE"));
    assert.ok(invalidStmtEval.violations.includes("SUBJECT_MISSING_SHA256_DIGEST"));
    assert.ok(invalidStmtEval.violations.includes("INCOMPLETE_PREDICATE_METADATA"));
    assert.ok(invalidStmtEval.violations.includes("MISSING_DSSE_SIGNATURE_ENVELOPE"));

    const emptySubjEval = evaluateSlsaLevel(fullStatement);
    assert.ok(emptySubjEval.violations.includes("EMPTY_SUBJECT_LIST"));

    // Level 1 when builder.id is missing despite DSSE envelope
    const noBuilderStmt = structuredClone(validStmt);
    noBuilderStmt.predicate.runDetails.builder.id = "";
    const noBuilderEval = evaluateSlsaLevel(noBuilderStmt, signedEnv);
    assert.equal(noBuilderEval.slsaLevel, "SLSA_LEVEL_1");

    // Level 2 when isolatedEnvironment is false or resolvedDependencies is omitted/non-array
    const nonIsolatedStmt = EosSlsaAttestor.buildProvenanceStatement({
      subjects: [{ name: "b.bin", digest: { sha256: "5678" } }],
      internalParameters: { isolatedEnvironment: false },
    });
    const nonIsolatedEval = evaluateSlsaLevel(nonIsolatedStmt, signedEnv);
    assert.equal(nonIsolatedEval.slsaLevel, "SLSA_LEVEL_2");

    const noDepsStmt = structuredClone(validStmt);
    noDepsStmt.predicate.buildDefinition.resolvedDependencies = undefined;
    const noDepsEval = evaluateSlsaLevel(noDepsStmt, signedEnv);
    assert.equal(noDepsEval.slsaLevel, "SLSA_LEVEL_3");
    assert.ok(!noDepsEval.verifiedChecks.includes("RESOLVED_DEPENDENCIES_RECORDED"));
  });
});
