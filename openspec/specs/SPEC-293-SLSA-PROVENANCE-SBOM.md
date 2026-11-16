# SPEC-293: SLSA Level 3/4 Attestations, In-Toto Provenance & Cryptographic SBOM Governor

- **Specification ID**: `SPEC-293`
- **Change ID**: `CHANGE-155`
- **Status**: `APPROVED`
- **Module**: `src/core/eosSlsaProvenanceGovernor.ts`
- **Tier**: Software Supply Chain Security & SLSA Provenance
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-293-01 (Event-Driven CycloneDX v1.5 & SPDX 2.3 SBOM Generation)**: WHEN repository source files or build artifacts are submitted for cataloging, THE SYSTEM SHALL generate compliant CycloneDX v1.5 and SPDX 2.3 JSON documents containing component identities, versions, licenses, and SHA-256 hashes.
- **FR-293-02 (State-Driven In-Toto v1 Statement & SLSA v1.0 Provenance Predicate)**: MIENTRAS an artifact build or verification pipeline executes, THE SYSTEM SHALL assemble an in-toto v1 Statement containing an SLSA v1.0 Provenance predicate (`https://slsa.dev/provenance/v1`) with `buildDefinition`, `runDetails`, and subject digests.
- **FR-293-03 (Dead Simple Signing Envelope DSSE Encoding & Ed25519 Signing)**: WHEN a provenance statement is signed, THE SYSTEM SHALL encode the payload into a standard DSSE envelope (`application/vnd.in-toto+json`) and sign it using an Ed25519 private key generated via `node:crypto`.
- **FR-293-04 (Cryptographic Envelope Verification & Tamper Detection)**: SI a signed DSSE envelope is presented with its corresponding public key, ENTONCES EL SISTEMA SHALL decode the payload pre-authentication encoding (PAE), verify the signature fail-closed, and detect any bit tampering in subject digests or metadata.
- **FR-293-05 (Supply Chain Policy & SLSA Level Evaluation)**: WHEN an attestation is inspected, THE SYSTEM SHALL evaluate whether the artifact meets SLSA Level 1 (documented build), Level 2 (hosted build service with signed provenance), or Level 3 (isolated environment, hardened against tampering, verified source).
- **FR-293-06 (Cryptographic Provenance Audit Receipt)**: WHEN a full provenance audit completes, THE SYSTEM SHALL record execution evidence at `docs/evidence/SLSA_PROVENANCE_RECEIPT.json` sealed with a SHA-256 digest.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1533 CycloneDX v1.5 and SPDX 2.3 SBOM Generation
  GIVEN a collection of repository source files and package manifests
  WHEN EosSbomGenerator generates CycloneDX and SPDX documents
  THEN both documents contain valid schema identifiers, component lists, and SHA-256 checksums
  AND zero external CLI dependencies (Syft) are invoked.

SCENARIO: BDD-1534 In-Toto v1 Statement and SLSA v1.0 Provenance Predicate Assembly
  GIVEN artifact targets, git commit hash, and verification test outputs
  WHEN EosSlsaAttestor builds an in-toto Statement
  THEN the statement type is "https://in-toto.io/Statement/v1"
  AND the predicateType is "https://slsa.dev/provenance/v1"
  AND the predicate records buildDefinition, runDetails, and subject digests.

SCENARIO: BDD-1535 DSSE Envelope Encoding and Ed25519 Signing
  GIVEN an in-toto provenance statement and an Ed25519 key pair
  WHEN EosDsseSigner signs the statement
  THEN it emits a DSSE envelope with payloadType "application/vnd.in-toto+json"
  AND includes a base64-encoded signature generated using Pre-Authentication Encoding (PAE).

SCENARIO: BDD-1536 DSSE Signature Verification and Tamper Detection
  GIVEN a valid DSSE envelope and a tampered DSSE envelope
  WHEN EosDsseSigner verifies signatures against the public key
  THEN the valid envelope returns verified=true
  AND the tampered envelope fails verification fail-closed.

SCENARIO: BDD-1537 SLSA Level Classification and Supply Chain Policy Verification
  GIVEN a signed provenance statement with source control uri, builder id, and test evidence
  WHEN evaluateSlsaLevel is invoked
  THEN it returns SLSA_LEVEL_3 with isolated build, cryptographic signature, and source traceability verified.

SCENARIO: BDD-1538 Cryptographic SLSA Provenance Receipt Generation
  GIVEN an audit executed via toolchain:slsa:verify or auditProvenancePipeline
  WHEN the audit completes
  THEN docs/evidence/SLSA_PROVENANCE_RECEIPT.json is written
  AND contains totalArtifactsAttested, slsaLevelAchieved, and a valid sha256Signature.
```
