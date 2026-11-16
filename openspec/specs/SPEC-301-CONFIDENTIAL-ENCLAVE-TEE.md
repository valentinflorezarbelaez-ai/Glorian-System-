# SPEC-301: Confidential Computing in Hardware TEEs (AWS Nitro / AMD SEV-SNP)

- **Specification ID**: `SPEC-301`
- **Change ID**: `CHANGE-163`
- **Status**: `APPROVED`
- **Module**: `src/core/eosConfidentialEnclaveGovernor.ts`
- **Tier**: Confidential Computing, Hardware TEEs & Secret Custody (Phase 4.2)
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-301-01 (Event-Driven PCR Measurement Computation)**: WHEN an enclave image, kernel, or application code bundle is submitted, THE SYSTEM SHALL compute deterministic SHA-256 Platform Configuration Registers (PCR0 for image, PCR1 for boot args, PCR2 for application code, PCR8 for IAM/role binding).
- **FR-301-02 (State-Driven Enclave Attestation Generation)**: MIENTRAS an enclave executes in a confidential execution boundary, THE SYSTEM SHALL generate an authenticated attestation document containing measured PCRs, a cryptographically random freshness nonce, the enclave public key, and a hardware root-of-trust signature.
- **FR-301-03 (State-Driven Remote Attestation Verification)**: MIENTRAS a remote coordinator receives an attestation document, THE SYSTEM SHALL verify the digital signature against the hardware root-of-trust certificate, validate nonce freshness to prevent replay attacks, and assert PCR measurements against authorized baseline values.
- **FR-301-04 (Event-Driven Hardware-Bound Secret Sealing)**: WHEN a sensitive payload (deployment secret, private key, or signing token) is sealed, THE SYSTEM SHALL derive an encryption key via HKDF-SHA256 bound to PCR0 and PCR2 measurements and encrypt the payload using AES-256-GCM with authenticated tags.
- **FR-301-05 (Error / Unwanted Condition: Anti-Tamper & Measurement Drift Guard)**: SI an unseal request is executed with mismatched PCR measurements or tampered ciphertext, ENTONCES EL SISTEMA SHALL abort the unseal operation fail-closed with `ENCLAVE_MEASUREMENT_MISMATCH` or `SEALED_PAYLOAD_TAMPERED`.
- **FR-301-06 (Cryptographic Proof Receipt)**: WHEN an enclave attestation or verification audit completes, THE SYSTEM SHALL emit a verification receipt at `docs/evidence/TEE_ENCLAVE_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1581 Hardware Platform Configuration Register (PCR) Measurement Computation
  GIVEN an enclave definition specifying image code, boot parameters, and application bundle
  WHEN the governor computes hardware registers
  THEN PCR0, PCR1, PCR2, and PCR8 are deterministically calculated as 64-character SHA-256 hex strings
  AND identical inputs yield bit-for-bit identical register digests.

SCENARIO: BDD-1582 Enclave Attestation Document Generation and Nonce Freshness
  GIVEN an active confidential enclave and a caller-supplied freshness nonce
  WHEN the enclave generates an attestation document
  THEN the document includes the exact nonce, enclave ephemeral public key, timestamp, and PCR measurements
  AND is signed by the hardware root of trust.

SCENARIO: BDD-1583 Cryptographic Attestation Verification against Root-of-Trust
  GIVEN an authentic attestation document and authorized PCR baseline values
  WHEN the remote verifier validates the attestation document
  THEN signature validation succeeds, nonce freshness is confirmed, and PCR measurements match the baseline
  AND the verifier emits an ATTESTATION_VERIFIED verdict.

SCENARIO: BDD-1584 Hardware-Bound Secret Sealing (AES-256-GCM + PCR0/PCR2 Derivation)
  GIVEN a sensitive plaintext secret and matching enclave PCR measurements
  WHEN the governor seals the secret
  THEN the derived key is bound to PCR0 and PCR2 via HKDF-SHA256
  AND the resulting ciphertext includes a 12-byte IV, 16-byte authentication tag, and decrypts successfully only under identical measurements.

SCENARIO: BDD-1585 Tamper Rejection and PCR Measurement Drift Enforcement
  GIVEN a sealed payload and an unseal attempt with altered code (drifting PCR0 or PCR2) or tampered ciphertext
  WHEN unseal is attempted
  THEN the governor rejects the operation fail-closed
  AND throws ENCLAVE_MEASUREMENT_MISMATCH or SEALED_PAYLOAD_TAMPERED without leaking plaintext data.

SCENARIO: BDD-1586 End-to-End Cryptographic Audit Receipt Generation
  GIVEN an audit executed via toolchain:enclave:verify or auditConfidentialEnclavePipeline
  WHEN the audit completes
  THEN docs/evidence/TEE_ENCLAVE_RECEIPT.json is written
  AND contains totalEnclavesAudited, attestationValid, sealingVerified, pcrIntegrityGuarded, and a valid sha256Signature.
```
