# SPEC-167: Config Hot-Reload Engine with Atomic Swap and Rollback

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arboláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Services that require a redeploy to change configuration lose availability and make emergency rollbacks slow. The `EosConfigHotReloadEngine` module lets a running process accept new configuration at runtime while preserving a last-known-good snapshot, following the atomic-swap and rollback model used by Apollo and Spring Cloud Config.

Every candidate configuration must pass a caller-supplied validator before it is applied; an invalid candidate is rejected and the current snapshot is left untouched. Accepted candidates are deep-frozen, assigned a monotonically increasing version, hashed into a content digest, and swapped in a single synchronous step so that readers never observe a partially applied configuration.

The engine also maintains a bounded version history for explicit rollback and notifies subscribed listeners only on successful swaps, keeping side effects decoupled from the validation gate. It is Layer-0, relying solely on Node.js built-ins and the shared kernel primitives.

## 2. Functional Requirements (EARS Syntax)

- **FR-761 (Event-Driven - Validated Atomic Swap)**: `WHEN push receives a candidate object that passes the validator, the system shall deep-freeze the candidate, build a snapshot with an incremented version and a content digest, apply it atomically as the current snapshot, and return accepted true with the applied snapshot.`
- **FR-762 (State-Driven - Version Monotonicity)**: `WHILE successive pushes are accepted, the system shall assign each snapshot a version equal to the previous version plus one, with the first accepted snapshot receiving version 1.`
- **FR-763 (Unwanted Condition - Validation Rejection)**: `IF the validator returns a violation string for a candidate, THEN the system shall reject the push, preserve the current snapshot, and return accepted false with the rejection reason and rolledBackTo set to the current version.`
- **FR-764 (Event-Driven - Listener Notification)**: `WHEN a push is accepted or an explicit rollback succeeds, the system shall notify every subscribed listener with the next snapshot and the previous snapshot (or null when none existed).`
- **FR-765 (Event-Driven - Historical Rollback)**: `WHEN rollback is called with a version present in history, the system shall set the current snapshot to that version and return accepted true; otherwise it shall return accepted false with a reason.`
- **FR-766 (Ubiquitous - Bounded History and Unsubscribe)**: `The system shall retain at most maxHistory snapshots, expose historyVersions() in ascending order, and have subscribe() return an unsubscribe function that stops further notifications for that listener.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-761 Valid pushes increment the version and invalid pushes preserve it
  GIVEN a hot-reload engine with a validator requiring a positive numeric timeoutMs
  WHEN push({timeoutMs: 100}) and push({timeoutMs: 200}) are called
  THEN the applied versions are 1 and 2 respectively
  AND when push({timeoutMs: -1}) is called it returns accepted false while get().version remains 1
```

```gherkin
SCENARIO: BDD-762 Listeners are notified only on successful swaps
  GIVEN a hot-reload engine with a subscribed listener recording applied versions
  WHEN a valid 50ms push, an invalid -5ms push, and a valid 75ms push occur
  THEN the listener observes versions [1, 2]
  AND the rejected push produces no notification
```

```gherkin
SCENARIO: BDD-763 Rollback restores a historical snapshot
  GIVEN a hot-reload engine that has applied timeoutMs 10, then 20, then 30
  WHEN rollback(1) is called
  THEN the result is accepted true
  AND get().config.timeoutMs equals 10
```

```gherkin
SCENARIO: BDD-764 Digests are content-addressed and unsubscribe stops notifications
  GIVEN a hot-reload engine pushed twice with the identical body {timeoutMs: 42}
  WHEN both applied snapshots are compared
  THEN their digests are equal because the digest is derived from content, not version
  AND after an unsubscribe function is invoked, a further push does not increment the listener count
```

## 4. Architecture Decision Records (ADRs)

- **ADR-167-1: Validate-then-swap with last-known-good preservation**

  - _Context_: Applying an invalid configuration to a running process can cause an outage, and operators need a guaranteed fallback position.
  - _Decision_: Run the validator before any mutation; on violation return a rejection result carrying the reason and the retained current version, and never touch the applied snapshot.
  - _Consequence_: The engine guarantees a valid or unchanged configuration at every instant, but the validator must be supplied by the caller and runs on every push.

- **ADR-167-2: Immutable snapshots with content-addressed digests and bounded history**
  - _Context_: Readers must see a consistent configuration, and operators need to reason about equality and rollback deterministically.
  - _Decision_: Deep-freeze each accepted snapshot, derive its digest from `pureSha256(JSON.stringify(frozen))`, and keep a FIFO history bounded by maxHistory supporting rollback by version.
  - _Consequence_: Configuration is immutable and equality is content-based (identical bodies share digests regardless of version), while history memory stays bounded.

## 5. Atomic Task DAG

1. [x] **TASK-167-1**: Author SPEC-167 defining hot-reload requirements, BDD scenarios, and ADRs.
2. [x] **TASK-167-2**: Implement `src/core/eosConfigHotReloadEngine.ts` with validator gate, atomic swap, version history, rollback, and listeners.
3. [x] **TASK-167-3**: Add the `SPEC-167` suite to `test/eosBigTechTransactions.test.mjs` covering versioning, rejection, notifications, rollback, digests, and unsubscribe.
4. [x] **TASK-167-4**: Verify with `npm run typecheck` and the CI pipeline stages (7/7 exit code 0).
