# SPEC-152: Secrets Auto-Rotation Protocol

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Long-lived credentials are a standing security liability: their compromise window grows with their age, and operators rarely rotate proactively. A lifecycle protocol that tracks credential age against a time-to-live and surfaces rotation urgency removes that judgement. The module header of `src/core/eosSecretsRotationProtocol.ts` cites the **HashiCorp Vault / Google Cloud Secret Manager pattern** as the governing doctrine.

The `EosSecretsRotationProtocol` manages secret metadata — never the secret value itself — recording creation time, TTL, rotation-overlap window, last rotation and version, plus a truncated SHA-256 fingerprint of that metadata. From this it derives an urgency tier GREEN, AMBER, RED or EXPIRED, and the percentage of the TTL consumed.

The approach supports a simulated zero-downtime dual-credential swap: a rotation increments the version, resets the age baseline and opens an overlap window during which both the old and new credentials would be considered valid. Rotation produces a SHA-256 receipt, and the protocol lists every secret requiring immediate action (RED or EXPIRED), all with no external dependency.

## 2. Functional Requirements (EARS Syntax)

- **FR-611 (Event-Driven - Secret Metadata Registration)**: When `register` is invoked with a name, a TTL and an optional rotation-overlap window, the system shall record metadata with a creation timestamp, version 1, no last-rotation time, and a truncated SHA-256 fingerprint derived from the name, timestamp, TTL and version, rejecting a non-positive TTL or a negative overlap.
- **FR-612 (Ubiquitous - Rotation Urgency Derivation)**: The system shall compute, for a registered secret, the age percentage as `round(ageMs / ttlMs * 100)` capped at 100 and the remaining milliseconds as `max(0, ttlMs - ageMs)`, and derive urgency as EXPIRED when remaining time is at or below zero, RED when age is at least 90 percent, AMBER when age is at least 70 percent, and GREEN otherwise.
- **FR-613 (Event-Driven - Rotation Execution and Version Increment)**: When `rotate` is invoked on a registered secret, the system shall increment the version by one, reset the creation timestamp to the rotation instant, record the last-rotation time, and return the previous and new versions together with the rotation instant and the overlap expiry.
- **FR-614 (Ubiquitous - Rotation Receipt Generation)**: The system shall attach to every rotation result a `sha256Receipt` computed over the canonical string `"name|previousVersion|newVersion|rotatedAtMs"`, whose hexadecimal length is 64 characters.
- **FR-615 (Event-Driven - Bulk Rotation Triage)**: When `needsRotation` is invoked, the system shall return the names of all registered secrets whose current urgency is RED or EXPIRED, and `getAllStatuses` shall return the status of every registered secret.
- **FR-616 (Unwanted Condition - Unregistered Secret Access)**: If `getStatus` or `rotate` is invoked for a secret name that was never registered, then the system shall fail the operation's precondition instead of returning a fabricated status.

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-611 A freshly registered secret is GREEN at version 1
  GIVEN a rotation protocol with a secret "api-key" registered with a 24-hour TTL
  WHEN the status of "api-key" is queried
  THEN the urgency equals "GREEN"
  AND the version equals 1
```

```gherkin
SCENARIO: BDD-612 Rotation increments the version and mints a receipt
  GIVEN a rotation protocol with a secret "db-pass" registered with a 1-hour TTL
  WHEN "db-pass" is rotated
  THEN the previous version equals 1 and the new version equals 2
  AND the returned sha256Receipt has a length of 64 characters
```

```gherkin
SCENARIO: BDD-613 An exhausted TTL reports EXPIRED urgency
  GIVEN a rotation protocol with a secret "old-token" registered with a 1-millisecond TTL
  WHEN the TTL elapses and the status is queried
  THEN the urgency equals "EXPIRED"
```

```gherkin
SCENARIO: BDD-614 needsRotation lists only the secrets in RED or EXPIRED state
  GIVEN a protocol with a healthy 24-hour secret and a secret whose TTL expires immediately
  WHEN the short-lived secret has expired and needsRotation is queried
  THEN the result includes "dying"
  AND the result does not include "healthy"
```

## 4. Architecture Decision Records (ADRs)

- **ADR-152-1: Metadata-only lifecycle tracking (no secret values stored)**

  - _Context_: A rotation manager that persists secret material becomes itself a high-value target.
  - _Decision_: Store only lifecycle metadata and a truncated SHA-256 fingerprint over that metadata, never the credential value.
  - _Consequence_: The protocol can compute urgency and receipts without ever holding usable secrets, bounding the blast radius of a compromise.

- **ADR-152-2: Urgency thresholds derived from TTL consumption with an overlap window**
  - _Context_: Operators need early warning before a credential lapses, and rotation should not break in-flight consumers.
  - _Decision_: Map age percentage to GREEN (<70), AMBER (>=70), RED (>=90) and EXPIRED (remaining <= 0), and open a configurable dual-credential overlap window on rotation.
  - _Consequence_: Proactive rotation is encouraged and zero-downtime swaps are modelled, while the fixed thresholds require code changes to tune.

## 5. Atomic Task DAG

1. [x] **TASK-152-1**: Author this specification defining FR-611..FR-616 and BDD-611..BDD-614 for the secrets rotation protocol.
2. [x] **TASK-152-2**: Implement `src/core/eosSecretsRotationProtocol.ts` with `EosSecretsRotationProtocol.register`, `getStatus`, `rotate` and `needsRotation`.
3. [x] **TASK-152-3**: Implement BDD tests `BDD-510`..`BDD-513` in `test/eosBigTechObservability.test.mjs` (`describe("SPEC-152: ...")`).
