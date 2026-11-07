# SPEC-160: Event Sourcing Engine with Append-Only Log, Snapshots and Optimistic Concurrency

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Mutable, in-place state destroys the audit trail and makes it impossible to reconstruct how the system reached its current shape. This module adopts the append-only event-log pattern used by Apache Kafka and Databricks Delta: facts are written once and never mutated, and read models are derived by replaying those facts through a reducer. Every event receives a per-stream monotonic version and a global offset, giving consumers a stable, totally ordered cursor.

Replay of an unbounded log is expensive, so the engine supports snapshots. A snapshot captures the reduced state at a stream version (the "replay floor"); a later rebuild seeds the reducer from the snapshot and folds only the events above that floor, trading storage for recovery time. This is the standard snapshot-plus-replay recovery model of event-sourced systems.

`EosEventSourcingEngine` also guards against lost updates with optimistic concurrency control: an application may pass the version it expects, and the write is rejected if the stream has advanced. Integrity is independently verifiable because each event stores a deterministic SHA-256 hash recomputable from its fields. The module lives in Layer 0 with zero external dependencies.

## 2. Functional Requirements (EARS Syntax)

- **FR-691 (Ubiquitous - Append-Only Immutable Log)**: `The EOS System shall persist every event as an immutable, deep-frozen DomainEvent carrying a per-stream monotonically increasing version equal to the current version plus one, a global offset equal to the current log length, a timestamp, and a deterministic eventHash computed as the SHA-256 digest over the event's streamId, version, globalOffset, type, payload and timestampMs.`
- **FR-692 (Event-Driven - Optimistic Concurrency Guard)**: `When append is called with an expectedVersion, the EOS System shall accept the write only if expectedVersion equals the current stream version, and shall otherwise raise a precondition failure whose message begins with "Concurrency conflict".`
- **FR-693 (State-Driven - Snapshot-Accelerated Rebuild)**: `While rebuilding a stream, the EOS System shall resume from the latest stored snapshot when one exists (using its version as the replay floor and its state as the accumulator seed) or from the supplied initial state otherwise, and shall fold only events with version greater than the replay floor through the reducer.`
- **FR-694 (Event-Driven - Snapshot Persistence)**: `When snapshot is called for a stream, the EOS System shall capture the current stream version together with a snapshotHash computed over the streamId, version and state, store it, and return it to accelerate subsequent rebuilds.`
- **FR-695 (Unwanted Condition - Integrity Verification)**: `If verifyIntegrity is invoked, then the EOS System shall recompute each event's hash and return the global offset of the first event whose recomputed hash differs from its stored eventHash, or return -1 when the entire log is intact.`
- **FR-696 (Ubiquitous - Deterministic Log Fingerprint)**: `The EOS System shall expose logFingerprint as the SHA-256 digest over the concatenation of all stored event hashes, such that appending any new event changes the fingerprint, and shall expose eventCount as the total number of appended events across all streams.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-691 Append Produces Monotonic Version and Global Offset
  GIVEN a fresh EosEventSourcingEngine with an empty log
  WHEN two events are appended to stream "order-1"
  THEN the first event has version 1
  AND the second event has version 2
  AND the second event has a global offset of 1
```

```gherkin
SCENARIO: BDD-692 Optimistic Concurrency Rejects Stale Writes
  GIVEN stream "s" already contains one event at version 1
  WHEN append is called for "s" with expectedVersion 0
  THEN the engine raises a precondition failure
  AND the failure message matches "Concurrency conflict"
```

```gherkin
SCENARIO: BDD-693 Rebuild Reduces Events With Snapshot Acceleration
  GIVEN a "counter" stream reduced by summing payload.delta
  WHEN five increment events of delta 1 are appended and the stream is rebuilt from state 0
  THEN the rebuilt state equals 5
  AND after snapshotting at version 5 and appending one increment of delta 3, the rebuilt state equals 8
```

```gherkin
SCENARIO: BDD-694 Integrity Verification and Log Fingerprint
  GIVEN a log containing two intact events
  WHEN verifyIntegrity is invoked
  THEN it returns -1
  AND appending a new event changes logFingerprint from its previous value
```

## 4. Architecture Decision Records (ADRs)

- **ADR-160-1: Append-Only Log as the Single Source of Truth**
  - _Context_: Mutable current-state storage loses history and cannot support audit, replay or temporal queries.
  - _Decision_: Persist immutable, deep-frozen events and derive all read models by reducing the log, following the Kafka / Databricks Delta immutable-log pattern.
  - _Consequence_: State is always reconstructible and auditable; read models pay a replay cost that must be mitigated by snapshots.
- **ADR-160-2: Per-Stream Optimistic Concurrency with Snapshot-Plus-Replay Recovery**
  - _Context_: Concurrent writers can silently overwrite each other, and full-log replay is expensive at scale.
  - _Decision_: Guarantee writes through an expected-version guard and accelerate recovery with version-stamped snapshots that set the replay floor.
  - _Consequence_: Callers must handle concurrency conflicts explicitly, and snapshot staleness must be bounded by periodic re-snapshotting.

## 5. Atomic Task DAG

1. [x] **TASK-160-1**: Author SPEC-160 (this document) defining the append-only log, snapshot and concurrency contracts.
2. [x] **TASK-160-2**: Implement `EosEventSourcingEngine` in `src/core/eosEventSourcingEngine.ts` with append, readStream, rebuild, snapshot and verifyIntegrity.
3. [x] **TASK-160-3**: Implement deterministic `eventHash` and `logFingerprint` using `pureSha256`.
4. [x] **TASK-160-4**: Verify the behavior with the SPEC-160 scenarios in `test/eosBigTechDistributed.test.mjs`.
