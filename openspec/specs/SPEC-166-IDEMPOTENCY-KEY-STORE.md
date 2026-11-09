# SPEC-166: Idempotency Key Store with Replay Detection

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arboláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Network clients retry mutations, and a retried mutation must not charge a card twice or create a duplicate resource. The `EosIdempotencyKeyStore` module implements the idempotency-key doctrine used by Stripe and AWS API Gateway: a caller supplies a key that identifies a logical mutation, and the store guarantees the mutation is processed at most once within a bounded time window.

The store caches the response of a completed mutation and returns it verbatim on replay, tracks in-flight keys so concurrent duplicate callers observe the first attempt rather than starting a second one, and fingerprints the request payload so that reusing a key with a different body is treated as a replay-attack signal instead of a benign retry.

The module is Layer-0: it uses only a private `Map`, the shared `deepFreeze`/`pureSha256`/`assertPrecondition` primitives, and no external dependency, keeping TTL accounting and fingerprinting deterministic and in-process.

## 2. Functional Requirements (EARS Syntax)

- **FR-751 (Event-Driven - New Key Registration)**: `WHEN begin is called with a non-empty key, a positive TTL, and either an unknown or an expired key, the system shall create an "IN_FLIGHT" record carrying the request fingerprint and an expiry timestamp, and return a "NEW" outcome.`
- **FR-752 (State-Driven - In-Flight Concurrency)**: `WHILE an existing record for the key is "IN_FLIGHT", not expired, and its request fingerprint matches, the system shall return an "IN_FLIGHT_WAIT" outcome without creating a second record.`
- **FR-753 (Event-Driven - Cached Replay)**: `WHEN begin is called for an existing, non-expired "COMPLETED" record whose request fingerprint matches, the system shall return a "REPLAY" outcome carrying the cached response.`
- **FR-754 (Unwanted Condition - Replay Attack)**: `IF begin is called with an existing, non-expired key whose request fingerprint differs from the stored one, THEN the system shall return a "REPLAY_ATTACK" outcome and refuse to process the mutation.`
- **FR-755 (Event-Driven - Abort and Retry)**: `WHEN abort is called for an "IN_FLIGHT" record, the system shall delete it and return true, so that a subsequent begin with the same key yields a "NEW" outcome again.`
- **FR-756 (Ubiquitous - TTL Sweep and Deterministic Fingerprint)**: `The system shall purge records whose expiry has elapsed via sweep() returning the count purged, and expose storeFingerprint() as a deterministic pureSha256 digest over records sorted by key and reduced to key, state, and request fingerprint.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-751 First mutation is NEW and a completed duplicate replays the cached response
  GIVEN an empty idempotency store
  WHEN begin("k", {a: 1}, 60000) is called, then complete("k", {id: "ch_123"}) is called
  AND begin("k", {a: 1}, 60000) is called again
  THEN the first outcome kind is "NEW"
  AND the second outcome kind is "REPLAY" with response {id: "ch_123"}
```

```gherkin
SCENARIO: BDD-752 Reusing a key with a different payload is a REPLAY_ATTACK
  GIVEN an idempotency store with an in-flight record for key "k" created from {amount: 10}
  WHEN begin("k", {amount: 999}, 60000) is called with a different payload
  THEN the outcome kind is "REPLAY_ATTACK"
  AND the stored record is preserved unchanged
```

```gherkin
SCENARIO: BDD-753 Concurrent duplicate while IN_FLIGHT waits on the first attempt
  GIVEN an idempotency store whose key "k" is already "IN_FLIGHT" from an identical payload
  WHEN begin("k", {p: 1}, 60000) is called again before completion
  THEN the outcome kind is "IN_FLIGHT_WAIT"
```

```gherkin
SCENARIO: BDD-754 Abort releases the in-flight lock and sweep purges expired records
  GIVEN an idempotency store with an in-flight record for key "k"
  WHEN abort("k") is called and then begin("k", {p: 1}, 60000) is called
  THEN abort returns true and the new outcome kind is "NEW"
  AND a record registered with a 1ms TTL, after it expires, is counted by sweep()
```

## 4. Architecture Decision Records (ADRs)

- **ADR-166-1: Payload fingerprint distinguishes retries from replay attacks**

  - _Context_: The same idempotency key may be legitimately retried with an identical body, or maliciously reused with a mutated body; the store must tell them apart deterministically.
  - _Decision_: Fingerprint the request payload with `pureSha256(JSON.stringify(payload))` and compare it against the stored fingerprint; a mismatch yields a "REPLAY_ATTACK" outcome.
  - _Consequence_: Legitimate retries replay safely while key reuse with altered content is refused, at the cost of requiring stable payload serialization.

- **ADR-166-2: In-process Map with TTL sweep and best-effort abort semantics**
  - _Context_: Concurrent duplicates must not start a second mutation, and a crashed first attempt must be recoverable without leaving a poisoned key.
  - _Decision_: Model state as a private `Map` with `IN_FLIGHT`/`COMPLETED` states and explicit `createdAtMs`/`expiresAtMs`; expose `abort` to release in-flight keys and `sweep` to purge expired ones.
  - _Consequence_: The store stays dependency-free and deterministic, but durability and cross-process coordination are intentionally out of scope and must be provided by a surrounding store.

## 5. Atomic Task DAG

1. [x] **TASK-166-1**: Author SPEC-166 defining idempotency requirements, BDD scenarios, and ADRs.
2. [x] **TASK-166-2**: Implement `src/core/eosIdempotencyKeyStore.ts` with key registration, in-flight locking, replay detection, abort, and sweep.
3. [x] **TASK-166-3**: Add the `SPEC-166` suite to `test/eosBigTechTransactions.test.mjs` covering NEW, REPLAY, REPLAY_ATTACK, IN_FLIGHT_WAIT, abort, and sweep.
4. [x] **TASK-166-4**: Verify with `npm run typecheck` and the CI pipeline stages (7/7 exit code 0).
