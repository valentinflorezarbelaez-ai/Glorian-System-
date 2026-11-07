# SPEC-175: TLS Certificate Lifecycle Manager — Issuance, Renewal Window, Revocation and Chain Verification

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Automated certificate management (cert-manager, ACME/Let's Encrypt, and cloud PKI services) treats certificates as short-lived, continuously rotated assets rather than long-lived artifacts. The core lifecycle rules are uniform across ecosystems: a certificate is active until it enters a renewal window before expiry, must be renewed before it expires, and may be revoked at any time, with a certificate revocation list (CRL) and chain-of-trust verification binding leaves to intermediates and roots.

This specification governs `EosCertificateLifecycleManager` in `src/core/eosCertificateLifecycleManager.ts`, the Layer 0 certificate-lifecycle model of the EOS control plane. The manager issues certificates with serials, SANs and content fingerprints; projects a status of ACTIVE, RENEWING, EXPIRED or REVOKED; renews by retiring the old serial; maintains a deterministic revocation list; and verifies issuer linkage across a leaf-to-root chain.

The module is deliberately dependency-free and deterministic (Law V): validity is computed from day counts rather than a real clock where possible, serials are a monotonic hex counter, and both the certificate fingerprint and the CRL fingerprint are pure SHA-256 values, so identical lifecycles yield identical fingerprints for CI regression tracking.

## 2. Functional Requirements (EARS Syntax)

- **FR-841 (Event-Driven - Certificate Issuance)**: `WHEN issue(subject, issuer, sans, validityDays) is invoked with a non-empty subject and positive validityDays, THE SYSTEM shall mint a serial of the form "SN" plus an eight-digit hex counter, set notAfterMs = issuedAtMs + validityDays * 86,400,000, and record a SHA-256 fingerprint of the certificate fields.`
- **FR-842 (State-Driven - Status Projection)**: `WHILE projecting status(serial, nowMs), THE SYSTEM shall return REVOKED if the serial is revoked, otherwise EXPIRED if notAfterMs is at or before nowMs, otherwise RENEWING if the remaining days are within renewalWindowDays, otherwise ACTIVE.`
- **FR-843 (Event-Driven - Renewal)**: `WHEN renew(serial, validityDays) is invoked for a known serial, THE SYSTEM shall mark the old serial as revoked and issue a new certificate that preserves the subject, issuer and SANs with a new serial.`
- **FR-844 (Event-Driven - Chain Verification)**: `WHEN verifyChain(serials) is invoked, THE SYSTEM shall walk the leaf-to-root linkage, returning {ok:false, reason} for unknown, revoked, expired or unresolved root certificates and {ok:true} when every link resolves.`
- **FR-845 (Event-Driven - Manual Revocation)**: `WHEN revoke(serial) is invoked for an existing serial, THE SYSTEM shall add it to the revocation set and return true, and shall return false for an unknown serial.`
- **FR-846 (Ubiquitous - Deterministic CRL Fingerprint)**: `THE SYSTEM shall compute crlFingerprint() as a SHA-256 over the revoked serials sorted alphabetically, so that managers with identical revocation sets produce identical fingerprints.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-841 Status Reflects the Renewal Window
  GIVEN a manager with renewalWindowDays=30 and warnDaysBeforeExpiry=7
  WHEN a certificate is issued with 15 days of validity
  THEN status(serial) returns "RENEWING"
  AND a certificate issued with 365 days of validity returns "ACTIVE"
```

```gherkin
SCENARIO: BDD-842 Renewal Retires the Old Serial
  GIVEN a manager and a certificate issued with 300 days of validity
  WHEN renew is invoked on the certificate with 300 days of validity
  THEN the old serial status becomes "REVOKED"
  AND the newly issued serial status becomes "ACTIVE"
  AND the two serials differ
```

```gherkin
SCENARIO: BDD-843 Chain Verification Walks Issuer Linkage
  GIVEN a root CA, an intermediate issued by the root, and a leaf issued by the intermediate
  WHEN verifyChain is invoked with [leaf, intermediate, root]
  THEN the verification result is ok, with no break reported
```

```gherkin
SCENARIO: BDD-844 Chain With a Revoked Intermediate Breaks
  GIVEN a root, an intermediate and a leaf where the intermediate has been revoked
  WHEN verifyChain is invoked with [leaf, intermediate, root]
  THEN the verification result is not ok
  AND the reported reason is "revoked"
```

## 4. Architecture Decision Records (ADRs)

- **ADR-175-1: Day-count validity and monotonic hex serials instead of real X.509 encoding**

  - _Context_: Full X.509/ASN.1 encoding is heavyweight and requires external libraries, conflicting with the zero-dependency constraint, while the control plane only needs lifecycle semantics.
  - _Decision_: Model validity as whole days from `Date.now()` and generate serials as `SN` plus a zero-padded hexadecimal counter, keeping all date arithmetic and fingerprinting in-process.
  - _Consequence_: The lifecycle model is deterministic, dependency-free (Law V) and easy to test; it is a behavioral model, not a byte-compatible certificate encoder.

- **ADR-175-2: Single revoked set with a sorted CRL fingerprint**
  - _Context_: Revocation must be authoritative and reproducible, whether triggered manually or by renewal.
  - _Decision_: Keep one `Set` of revoked serials shared by `revoke` and `renew`, and derive `crlFingerprint()` from the alphabetically sorted serials so ordering never affects the digest.
  - _Consequence_: Renewal and revocation share one source of truth and the fingerprint is stable across managers; the model does not implement per-entry revocation timestamps or reasons.

## 5. Atomic Task DAG

1. [x] **TASK-175-1**: Author the SPEC-175 specification defining issuance, the renewal window, revocation and chain-verification rules.
2. [x] **TASK-175-2**: Implement `EosCertificateLifecycleManager` issuance and status projection in `src/core/eosCertificateLifecycleManager.ts`.
3. [x] **TASK-175-3**: Implement renewal, manual revocation and leaf-to-root `verifyChain` linkage checking.
4. [x] **TASK-175-4**: Add BDD coverage for status, renewal, revocation and chain verification in `test/eosBigTechDataPlane.test.mjs`.
