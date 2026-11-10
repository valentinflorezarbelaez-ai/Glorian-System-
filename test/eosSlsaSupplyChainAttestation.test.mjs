/**
 * Test Suite: EosSlsaSupplyChainAttestation (Layer 0 — Hermetic Supply-Chain & SLSA Level-4 Provenance)
 * SPEC-192: Hermetic Supply-Chain & SLSA Level-4 Provenance Attestation Engine
 * CHANGE-077: Hermetic Supply-Chain & SLSA Level-4 Provenance Attestation Engine
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosSlsaSupplyChainAttestation } from "../src/core/eosSlsaSupplyChainAttestation.ts";

describe("SPEC-192: EosSlsaSupplyChainAttestation", () => {
  it("BDD-979: generates canonical in-toto v1.0 statement with SLSA provenance metadata", () => {
    const subjects = [
      {
        name: "bin/glorian",
        digest: { sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
      },
    ];

    const statement = EosSlsaSupplyChainAttestation.generateProvenanceStatement({
      subjects,
      builderId: "https://glorian.system/builder/sovereign-control-plane",
    });

    assert.equal(statement._type, "https://in-toto.io/Statement/v1");
    assert.equal(statement.predicateType, "https://slsa.dev/provenance/v1");
    assert.equal(statement.subject.length, 1);
    assert.equal(statement.subject[0]?.name, "bin/glorian");
    assert.equal(
      statement.subject[0]?.digest.sha256,
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    assert.equal(statement.predicate.buildDefinition.resolvedDependencies.length, 0);
  });

  it("BDD-980: signs in-toto statement using native Ed25519 asymmetric cryptography", () => {
    const { privateKeyPem, publicKeyPem, keyId } = EosSlsaSupplyChainAttestation.generateEd25519KeyPair();

    assert.ok(privateKeyPem.includes("BEGIN PRIVATE KEY"));
    assert.ok(publicKeyPem.includes("BEGIN PUBLIC KEY"));
    assert.ok(keyId.startsWith("KEY-"));

    const statement = EosSlsaSupplyChainAttestation.generateProvenanceStatement({
      subjects: [
        {
          name: "dist/bundle.js",
          digest: { sha256: "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b" },
        },
      ],
    });

    const envelope = EosSlsaSupplyChainAttestation.signStatement(statement, privateKeyPem, keyId);

    assert.equal(envelope.payloadType, "application/vnd.in-toto+json");
    assert.ok(envelope.payload.length > 0);
    assert.equal(envelope.signatures.length, 1);
    assert.equal(envelope.signatures[0]?.keyid, keyId);
    assert.ok(envelope.signatures[0]?.sig.length > 0);
  });

  it("BDD-981: verifies authentic signature and detects post-signing payload tampering", () => {
    const { privateKeyPem, publicKeyPem, keyId } = EosSlsaSupplyChainAttestation.generateEd25519KeyPair();

    const statement = EosSlsaSupplyChainAttestation.generateProvenanceStatement({
      subjects: [
        {
          name: "glorian-core.tar.gz",
          digest: { sha256: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899" },
        },
      ],
    });

    const envelope = EosSlsaSupplyChainAttestation.signStatement(statement, privateKeyPem, keyId);

    // 1. Verify authentic envelope
    const validResult = EosSlsaSupplyChainAttestation.verifyEnvelope(envelope, publicKeyPem);
    assert.equal(validResult.verified, true);
    assert.ok(validResult.statement);
    assert.equal(validResult.statement?._type, "https://in-toto.io/Statement/v1");

    // 2. Tamper with payload (substitute modified JSON in base64)
    const tamperedStatement = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
    tamperedStatement.subject[0].name = "malicious-backdoor.tar.gz";
    const tamperedPayloadBase64 = Buffer.from(JSON.stringify(tamperedStatement)).toString("base64");

    const tamperedEnvelope = {
      ...envelope,
      payload: tamperedPayloadBase64,
    };

    const invalidResult = EosSlsaSupplyChainAttestation.verifyEnvelope(tamperedEnvelope, publicKeyPem);
    assert.equal(invalidResult.verified, false);
    assert.equal(invalidResult.error, "ED25519_SIGNATURE_INVALID");
  });

  it("BDD-982: generates CycloneDX v1.5 Software Bill of Materials (SBOM)", () => {
    const sbom = EosSlsaSupplyChainAttestation.generateCycloneDxSbom({
      appName: "glorian-system",
      version: "75.0.0",
      components: [
        {
          name: "eosKernelPrimitives",
          version: "75.0.0",
          sha256: "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
        },
        {
          name: "eosEnterpriseFacade",
          version: "75.0.0",
          sha256: "223344556677889900aabbccddeeff11223344556677889900aabbccddeeff11",
        },
      ],
    });

    assert.equal(sbom.bomFormat, "CycloneDX");
    assert.equal(sbom.specVersion, "1.5");
    assert.equal(sbom.metadata.component.name, "glorian-system");
    assert.equal(sbom.metadata.component.version, "75.0.0");
    assert.equal(sbom.components.length, 2);
    assert.equal(sbom.components[0]?.hashes[0]?.alg, "SHA-256");
  });
});
