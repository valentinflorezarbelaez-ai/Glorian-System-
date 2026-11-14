# SPEC-245 — Layer-0 In-Toto Statement v1 & SLSA v1.0 Ed25519 DSSE Attestor

## Metadata

- **SPEC ID**: SPEC-245
- **Change ID**: CHANGE-123
- **Intake ID**: INTAKE-123
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosInTotoSlsaEd25519AttestorCore`

---

## 1. Overview

`EosInTotoSlsaEd25519AttestorCore` constructs standards-compliant **In-Toto Statement v1** (`https://in-toto.io/Statement/v1`) provenance bundles carrying **SLSA Provenance v1.0** (`https://slsa.dev/provenance/v1`), signs them inside a **DSSE v1** envelope (`application/vnd.in-toto+json`) with native **Ed25519** cryptography (`node:crypto`), verifies DSSE signatures independently against payload tampering, and optionally persists bundles confined to `projectRoot`.

---

## 2. Functional Requirements (EARS Syntax)

**FR-245-001** (Event-Driven)
WHEN `issueShipAttestation(options)` runs, THE SYSTEM SHALL derive an Ed25519 key pair natively in `node:crypto`, construct an In-Toto v1 + SLSA Provenance v1.0 JSON statement referencing commit/diff/SARIF/contract subjects, sign the canonical DSSEv1 PAE (`DSSEv1 <typeLen> <type> <payloadLen> <payload>`), and verify the envelope before returning `verified = true`.

**FR-245-002** (Event-Driven)
WHEN `verifyDsseAttestation(envelope, publicKeyPem)` evaluates any DSSE envelope, THE SYSTEM SHALL recompute DSSEv1 PAE and validate the Ed25519 signature via `crypto.verify`, returning `verified = false` with an explicit `failureReason` if the payload or signature was tampered with.

**FR-245-003** (Error / Unwanted Condition)
IF `writeAttestationToDisk === true` and `outputRelPath` resolves outside `projectRoot`, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden`.

**FR-245-004** (Ubiquitous)
THE SYSTEM SHALL support confined disk output (default `.eos/ship-attestation.intoto.json`), return the `publicKeyPem`, `keyId`, and 64-hex `attestationDigestSha256`, and deep-freeze all returned objects.

---

## 3. BDD Acceptance Scenarios

### BDD-1246 — Issues And Cryptographically Verifies In-Toto v1 + SLSA v1.0 Ed25519 Bundle

```gherkin
SCENARIO: Issue signed DSSE In-Toto SLSA v1.0 attestation and verify signature
  GIVEN ticketId="SPOT-245" and valid SHA-256 subject digests
  WHEN issueShipAttestation executes and verifyDsseAttestation checks the envelope
  THEN statement._type is "https://in-toto.io/Statement/v1", predicateType is "https://slsa.dev/provenance/v1", and verified is true
```

### BDD-1247 — Detects Payload Tampering During DSSE Verification

```gherkin
SCENARIO: Reject DSSE envelope whose Base64 payload was altered after signing
  GIVEN a valid DsseEnvelope with one bit/character modified in payloadBase64
  WHEN verifyDsseAttestation evaluates the tampered envelope
  THEN verified is false and failureReason indicates signature mismatch
```

### BDD-1248 — Detects Signature Tampering During DSSE Verification

```gherkin
SCENARIO: Reject DSSE envelope with forged signature bytes
  GIVEN a valid DsseEnvelope with modified sigBase64 bytes
  WHEN verifyDsseAttestation evaluates the envelope
  THEN verified is false and failureReason indicates signature verification failure
```

### BDD-1249 — Confines Disk Persistence And Blocks Traversal Escape

```gherkin
SCENARIO: Write attestation bundle inside .eos/ and block external traversal paths
  GIVEN writeAttestationToDisk = true under a confined temp root AND an untrusted "../escape.intoto.json" case
  WHEN issueShipAttestation executes on both cases
  THEN the confined bundle is written cleanly on disk and the traversal case throws "Path traversal outside projectRoot is forbidden"
```

### BDD-1250 — Produces Deterministic Key ID And Attestation Digest

```gherkin
SCENARIO: Generate repeatable keyId and attestationDigestSha256 for identical inputs and keySeed
  GIVEN identical IssueShipAttestationOptions with deterministic keySeed
  WHEN issueShipAttestation runs twice
  THEN both bundles produce identical keyId, signatures, and 64-hex attestationDigestSha256
```
