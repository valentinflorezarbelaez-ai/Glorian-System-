# SPEC-304: Single Executable Applications (SEA) Automated Binary Distribution

- **Specification ID**: `SPEC-304`
- **Change ID**: `CHANGE-166`
- **Status**: `APPROVED`
- **Module**: `src/core/eosSingleExecutableDistributionGovernor.ts`
- **Tier**: Binary Distribution, Standalone Runtime & Post-Quantum Code Signing (Phase 4.5)
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-304-01 (Event-Driven Cross-Platform Matrix Synthesis)**: WHEN a distribution target matrix is queried, THE SYSTEM SHALL resolve binary specifications for all 5 tier-1 platforms (`linux-x64`, `linux-arm64`, `darwin-arm64`, `darwin-x64`, `win32-x64`), validating host architecture compatibility and execution flags.
- **FR-304-02 (State-Driven SEA Configuration and Blob Generation)**: MIENTRAS a binary distribution bundle is generated, THE SYSTEM SHALL synthesize a canonical `sea-config.json` manifest, compile the application entrypoint into a standalone SEA blob, and compute its SHA-256 fingerprint.
- **FR-304-03 (State-Driven Dual Cryptographic Code Signing)**: MIENTRAS a binary artifact is prepared for release, THE SYSTEM SHALL generate a dual cryptographic signature combining an Ed25519 classical keypair with post-quantum ML-DSA signature metadata, returning detached signature certificates.
- **FR-304-04 (Error / Unwanted Condition: Tampered Binary Rejection)**: SI the hash of a distribution binary does not match its cryptographic signature or declared manifest digest, ENTONCES EL SISTEMA SHALL reject distribution fail-closed with `TAMPERED_BINARY_DETECTED`.
- **FR-304-05 (Ubiquitous In-Toto Attestation and Distribution Packaging)**: EL SISTEMA SHALL package each target distribution bundle with its binary, detached signatures, SHA-256 checksums, and in-toto v1.0 provenance statement.
- **FR-304-06 (Cryptographic Proof Receipt)**: WHEN an end-to-end SEA distribution audit completes, THE SYSTEM SHALL write a cryptographically signed receipt to `docs/evidence/SEA_BINARY_RECEIPT.json` containing total target platforms, signature validity, and audit SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1599 Cross-Platform Target Matrix Validation
  GIVEN the SEA distribution governor
  WHEN getTargetMatrix() is invoked
  THEN exactly 5 tier-1 platforms are resolved (linux-x64, linux-arm64, darwin-arm64, darwin-x64, win32-x64)
  AND each platform declares valid binary extensions, ABI targets, and fuse configurations.

SCENARIO: BDD-1600 Deterministic SEA Config and Blob Synthesis
  GIVEN an entrypoint script (e.g. bin/eos.mjs)
  WHEN generateSeaConfig(entrypoint, outputPath) is invoked
  THEN a valid sea-config.json is synthesized with disableExperimentalSEAWarning=true
  AND deterministic SHA-256 digests are generated for the payload.

SCENARIO: BDD-1601 Dual Cryptographic Code Signing (Ed25519 + Post-Quantum ML-DSA)
  GIVEN an executable binary buffer or blob
  WHEN signBinaryArtifact(binaryBytes, keypair) is invoked
  THEN an Ed25519 signature is generated and verified
  AND an ML-DSA post-quantum signature envelope is attached with valid cryptographic receipt.

SCENARIO: BDD-1602 Tampered Binary Detection and Fail-Closed Guard
  GIVEN a signed distribution binary
  WHEN a single byte in the binary or signature is altered
  THEN verifyBinaryArtifact() rejects the binary returning valid=false and error TAMPERED_BINARY_DETECTED.

SCENARIO: BDD-1603 Distribution Bundle Packaging and In-Toto Provenance
  GIVEN a target platform and signed binary
  WHEN createDistributionBundle(platform, binaryBytes, signature) is invoked
  THEN a distribution bundle is created containing binary, signature, checksums, and in-toto provenance statement.

SCENARIO: BDD-1604 End-to-End Cryptographic SEA Audit Receipt
  GIVEN an audit executed via toolchain:sea:audit or auditSeaDistributionPipeline
  WHEN the audit completes
  THEN docs/evidence/SEA_BINARY_RECEIPT.json is written
  AND contains totalPlatforms, binariesVerified, dualSigningVerified, and a 64-hex sha256Signature.
```
