# SPEC-281: BITEMPORAL EVENT STORE & CHANGE DATA CAPTURE (CDC) GOVERNOR

## 1. Metadata

- **Specification ID**: `SPEC-281`
- **Change Reference**: `CHANGE-143`
- **Component**: `EosBitemporalEventStore`
- **Status**: `PROPOSED`
- **Version**: `1.0.0`
- **Classification**: Layer 0 Sovereign Event Sourcing & Bitemporal Data Core

---

## 2. Functional Requirements (EARS Syntax)

- **FR-281-01 (Event-Driven: Bitemporal Event Append)**:
  `WHEN` a domain event is appended via `appendEvent`,
  `THE SYSTEM SHALL` record monotonic `transactionTime`, retain caller `validTime`, and compute a SHA-256 hash linking the event to the stream's predecessor.

- **FR-281-02 (State-Driven: Exactly-Once Idempotency Enforcement)**:
  `WHILE` processing an append request,
  `THE SYSTEM SHALL` verify whether an event with the same `idempotencyKey` is present; `IF` present, `THEN THE SYSTEM SHALL` return the existing event without duplicate insertions.

- **FR-281-03 (State-Driven: Bitemporal Time-Travel State Reconstruction)**:
  `WHILE` reconstructing entity state via `replayEvents`,
  `THE SYSTEM SHALL` filter events where `validTime <= asOfValidTime` and `transactionTime <= asOfTransactionTime`, projecting the deterministic aggregate state as of that point.

- **FR-281-04 (Event-Driven: Change Data Capture (CDC) Feed Emission)**:
  `WHEN` stream changes are requested via `getChangeStream`,
  `THE SYSTEM SHALL` emit sequential CDC envelopes declaring operation type (`CREATE`, `UPDATE`, `DELETE`), before state snapshot, after state snapshot, and modified fields.

- **FR-281-05 (Unwanted Condition: Stream Hash Chaining Integrity Check)**:
  `IF` a tampered event hash or non-contiguous stream sequence is detected,
  `THEN THE SYSTEM SHALL` throw `EVENT_STORE_INTEGRITY_BREACH` and reject operations fail-closed.

- **FR-281-06 (Ubiquitous: Cryptographic Evaluation Receipt)**:
  `THE SYSTEM SHALL` record all stream counts, event counts, and verification hashes into `docs/evidence/EVENTSTORE_RECEIPT.json` sealed with a SHA-256 digest.

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-1461: Conforming Bitemporal Event Append and Hash Chaining
  GIVEN an empty or existing event stream
  WHEN appendEvent is invoked with valid event payload and validTime
  THEN the event SHALL be appended with a monotonic sequenceNumber
  AND transactionTime SHALL be stamped by the system
  AND eventHash SHALL link cryptographically to the prior event hash.

SCENARIO: BDD-1462: Exactly-Once Cryptographic Idempotency Deduplication
  GIVEN an existing event stream containing an event with idempotencyKey "tx-12345"
  WHEN appendEvent is invoked again with identical idempotencyKey "tx-12345"
  THEN the store SHALL return the existing event
  AND totalEventsCount SHALL not increase.

SCENARIO: BDD-1463: Deterministic Aggregate Replay & Time Travel
  GIVEN a sequence of events representing account balance changes over multiple days
  WHEN replayEvents is invoked with an asOfValidTime corresponding to an earlier date
  THEN the returned state SHALL reflect the exact balance as of that historical date.

SCENARIO: BDD-1464: Change Data Capture (CDC) Mutation Envelope Generation
  GIVEN an entity with consecutive state mutations (CREATE then UPDATE)
  WHEN getChangeStream is executed for that entity
  THEN the CDC envelopes SHALL contain operation "CREATE" with before=null and operation "UPDATE" with before/after state diff.

SCENARIO: BDD-1465: Rejection of Corrupted or Tampered Event Hash Chaining
  GIVEN an event stream where a historical event's payload has been modified
  WHEN verifyStreamIntegrity is executed
  THEN the result SHALL be false
  AND the error SHALL report "EVENT_STORE_INTEGRITY_BREACH".

SCENARIO: BDD-1466: Cryptographic SHA-256 Event Store Receipt Generation
  GIVEN completed event append and replay operations
  WHEN generateReceipt is invoked
  THEN docs/evidence/EVENTSTORE_RECEIPT.json SHALL be written
  AND the receipt SHALL include authentic SHA-256 digest and stream metrics.
```
