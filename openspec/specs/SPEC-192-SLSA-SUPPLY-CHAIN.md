# SPEC-192: Hermetic Supply-Chain & SLSA Level-4 Provenance Attestation Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Security
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / SLSA v1.0 / in-toto v1.0 / OpenSSF
- **Module**: `src/core/eosSlsaSupplyChainAttestation.ts`
- **Composes**: SPEC-096 (Sovereign PR Attestation), SPEC-186 (Enterprise Facade)

---

## 1. Context and Rationale

Software supply chain attacks (SolarWinds, Codecov, XZ Utils) represent the most critical vector threatening modern digital infrastructure. Consortia like the Linux Foundation, CNCF, and OpenSSF define SLSA (Supply-chain Levels for Software Artifacts) to guarantee hermetic builds, non-falsifiable provenance, and cryptographic verification of all deployed code.

This specification implements `EosSlsaSupplyChainAttestation`, providing native SLSA Level-4 in-toto v1.0 provenance generation, Ed25519 digital signing and verification, and CycloneDX-compatible SBOM emission under strictly zero external runtime dependencies.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-979 (Ubiquitous - Canonical in-toto v1.0 Statement)**: `THE SYSTEM SHALL generate canonical SLSA Provenance v1.0 statements formatted according to the in-toto v1.0 specification, mapping artifact names and SHA-256 digests to immutable builder metadata.`

- **FR-980 (Event-Driven - Ed25519 Digital Signing)**: `WHEN an artifact build or release is attested, THE SYSTEM SHALL sign the canonical provenance payload using native Ed25519 asymmetric cryptography.`

- **FR-981 (Event-Driven - Cryptographic Verification)**: `WHEN a signed provenance envelope is submitted, THE SYSTEM SHALL verify the Ed25519 digital signature against the public key, rejecting any envelope with mismatched digests or modified payloads.`

- **FR-982 (Ubiquitous - Deterministic CycloneDX SBOM)**: `THE SYSTEM SHALL generate a deterministic CycloneDX JSON software bill of materials certifying zero external runtime dependencies (dependencies: {}).`

- **FR-983 (Ubiquitous - Zero Dependencies)**: `THE SYSTEM SHALL execute all keypair generation, hashing, and digital signing using native Node.js crypto modules.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-979 Canonical in-toto statement generation
  GIVEN build artifacts with names and contents
  WHEN generateProvenanceStatement is invoked
  THEN statement _type is "https://in-toto.io/Statement/v1"
  AND predicateType is "https://slsa.dev/provenance/v1"
  AND each subject contains name and accurate sha256 digest

SCENARIO: BDD-980 Ed25519 digital signing and signature generation
  GIVEN an in-toto provenance statement and an Ed25519 private key
  WHEN signStatement is executed
  THEN a signed envelope is produced
  AND signature is a valid base64 string

SCENARIO: BDD-981 Signature verification and anti-tampering detection
  GIVEN a validly signed envelope and corresponding public key
  WHEN verifyEnvelope is called on unmodified envelope
  THEN verification succeeds with verified=true
  WHEN any character in the statement payload is altered
  THEN verification fails with verified=false

SCENARIO: BDD-982 CycloneDX SBOM certifying zero dependencies
  GIVEN the repository configuration
  WHEN generateCycloneDxSbom is invoked
  THEN bomFormat is "CycloneDX"
  AND components array contains only internal Layer-0 modules
  AND external dependencies count is strictly 0
```
