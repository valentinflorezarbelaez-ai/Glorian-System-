# SPEC-159: Distributed Lock Manager with Lease TTL and Fencing Tokens

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

In a horizontally scaled EOS fleet, independent workers must serialize access to shared resources such as shards, migration slots and singleton scheduled jobs. A naive in-process mutex is insufficient: holders can be paused by garbage collection or partitioned by the network and later resume with a stale belief that they still own the resource. Without a monotonic guard, such a resurrected holder can silently overwrite the work of the process that legitimately reclaimed the resource.

This module follows the etcd / Apache ZooKeeper lease-based locking model, in which every grant is TTL-bounded and auto-released on expiry. Each new grant also issues a strictly increasing fencing token, the discipline popularized by the Chubby lock service and by Martin Kleppmann's analysis of distributed locking, so that downstream storage can reject writes from stale holders.

`EosDistributedLockManager` implements this discipline in Layer 0 with zero external dependencies. It exposes `acquire`/`tryAcquire`, `release`, `isLocked`, `inspect`, `activeLocks` and a deterministic `stateFingerprint`, and returns deep-frozen results to prevent aliasing. Acquisition attempts that remain in contention are rejected synchronously with a stable reason code rather than blocking.

## 2. Functional Requirements (EARS Syntax)

- **FR-681 (Ubiquitous - Lease-Based Mutual Exclusion)**: `The EOS System shall maintain a lock registry keyed by resource key in which at most one holder holds an unexpired lease at any time, and shall return a LockResult carrying the acquired flag, the key, the holder, the fencing token and a reason code for every acquisition attempt.`
- **FR-682 (Event-Driven - Monotonic Fencing Token)**: `When a free or expired lock is granted, the EOS System shall assign a fencing token drawn from an internal monotonically increasing counter starting at 1, so that each new grant yields a strictly larger token than any prior grant by the same manager.`
- **FR-683 (State-Driven - Reentrant TTL Refresh)**: `While the same holder already holds an unexpired lock and re-acquires it, the EOS System shall refresh the lease expiry to now plus ttlMs and shall return the identical fencing token with reason ALREADY_HELD and acquired = true.`
- **FR-684 (Unwanted Condition - Contention Rejection)**: `If a lock is currently held by a different, unexpired holder, then the EOS System shall reject the request by returning acquired = false, reason HELD_BY_OTHER and fencingToken 0, without mutating the existing lease.`
- **FR-685 (Event-Driven - Holder-Only Release and Expiry Reclamation)**: `When release is invoked, the EOS System shall remove the lease and return true only if the caller matches the recorded holder, shall return false otherwise, and shall treat any expired lease as reclaimable by a subsequent acquisition while isLocked and inspect report it as not held.`
- **FR-686 (Ubiquitous - Deterministic State Fingerprint)**: `The EOS System shall expose stateFingerprint computed as the SHA-256 digest over the serialized active (non-expired) leases sorted by key, so that repeated calls over an unchanged active set return the same value.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-681 Acquire Free Lock Issues Monotonic Fencing Token
  GIVEN a fresh EosDistributedLockManager with no active leases
  WHEN worker-1 calls tryAcquire("resource:A", "worker-1", 1000)
  THEN the returned result has acquired = true
  AND the reason is "OK"
  AND the fencingToken is greater than or equal to 1
```

```gherkin
SCENARIO: BDD-682 Mutual Exclusion While Held By Another
  GIVEN lock "k" is held by holder "A" under an unexpired lease
  WHEN holder "B" calls tryAcquire("k", "B", 5000)
  THEN the result has acquired = false
  AND the reason is "HELD_BY_OTHER"
  AND the lease held by "A" remains unchanged
```

```gherkin
SCENARIO: BDD-683 Reentrant Acquisition Refreshes TTL With Same Token
  GIVEN holder "A" already holds an unexpired lease on "k"
  WHEN holder "A" calls tryAcquire("k", "A", 5000) again
  THEN the second result has acquired = true
  AND the reason is "ALREADY_HELD"
  AND the fencing token equals the token of the first acquisition
```

```gherkin
SCENARIO: BDD-684 Holder-Only Release and Expiry Reclamation
  GIVEN lock "k" is held by holder "A"
  WHEN holder "B" calls release("k", "B")
  THEN release returns false and the lease is untouched
  AND when holder "A" calls release("k", "A") it returns true and isLocked("k") becomes false
  AND once a lease expires a subsequent tryAcquire by another holder succeeds
```

## 4. Architecture Decision Records (ADRs)

- **ADR-159-1: Lease TTL with Monotonic Fencing Tokens over Centralized Coordination**
  - _Context_: A fleet of independent workers contends for shared resources, and paused or partitioned holders can resume with stale ownership beliefs.
  - _Decision_: Model locks as TTL-bounded leases that auto-release on expiry, and issue a strictly increasing fencing token from an internal counter on every new grant so consumers can discard stale writes.
  - _Consequence_: Correctness no longer depends on clock agreement between workers; downstream systems must store and compare the token, and each manager instance maintains its own monotonic counter.
- **ADR-159-2: Synchronous, Deep-Frozen Lock Results**
  - _Context_: Deterministic testing and zero runtime dependencies are required (Law V).
  - _Decision_: Implement acquisition synchronously with no blocking wait-queue resolution, and return deep-frozen LockResult values.
  - _Consequence_: Contending callers must retry externally; results are immutable and safe to share without defensive copying.

## 5. Atomic Task DAG

1. [x] **TASK-159-1**: Author SPEC-159 (this document) defining lease semantics, fencing token monotonicity and the result contract.
2. [x] **TASK-159-2**: Implement `EosDistributedLockManager` in `src/core/eosDistributedLockManager.ts` with acquire, tryAcquire, release, isLocked, inspect and activeLocks.
3. [x] **TASK-159-3**: Implement the deterministic `stateFingerprint` using `pureSha256` over key-sorted active leases.
4. [x] **TASK-159-4**: Verify the behavior with the SPEC-159 scenarios in `test/eosBigTechDistributed.test.mjs`.
