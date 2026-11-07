# SPEC-171: Distributed Cache Engine — LRU Eviction, TTL Expiry, and Singleflight Stampede Protection

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Hot data paths in distributed systems repeatedly read the same keys, yet re-fetching them from a slow backend on every request collapses latency budgets and amplifies load. Production caches (Redis, Memcached) solve this with bounded in-memory stores, per-entry time-to-live, and least-recently-used (LRU) eviction; the notorious "thundering herd" / cache stampede failure mode is mitigated by singleflight de-duplication (coalescing concurrent misses for the same key into one backend call), a pattern popularized by Go's `singleflight` package and Memcached clients.

This specification governs `EosCacheEngine` in `src/core/eosCacheEngine.ts`, the Layer 0 in-process cache for the EOS control plane. The module implements bounded LRU storage, lazy TTL expiration, cache-aside loading with singleflight coalescing, and deterministic hit/miss/eviction/coalescing telemetry plus a hashed state fingerprint.

The approach is deliberately allocation-light and dependency-free (Law V): the store is a `Map` whose insertion order encodes LRU recency, TTL is evaluated lazily on read, and the state fingerprint is a pure SHA-256 over the sorted set of live keys, making cache state reproducible for CI regression tracking.

## 2. Functional Requirements (EARS Syntax)

- **FR-801 (Ubiquitous - Bounded LRU Capacity)**: `THE SYSTEM shall maintain the store size at or below the configured maxEntries, evicting the least-recently-used key when a new key is inserted at capacity, and shall promote an entry to the most-recently-used position each time it is read via get().`
- **FR-802 (Event-Driven - Lazy TTL Expiration)**: `WHEN get(key) is invoked on an entry whose expiresAtMs has passed, THE SYSTEM shall delete the entry, increment the expired counter, count the access as a miss, and return undefined.`
- **FR-803 (Event-Driven - TTL-Bounded Insertion)**: `WHEN set(key, value, ttlMs) is invoked with a positive ttlMs, THE SYSTEM shall store the entry with expiresAtMs = Date.now() + ttlMs, replacing any prior value for the same key.`
- **FR-804 (Event-Driven - Singleflight Coalescing)**: `WHEN load(key, loader) is invoked while a load for the same key is already in flight, THE SYSTEM shall return the existing in-flight promise and increment stampedesCoalesced instead of invoking the loader again.`
- **FR-805 (Ubiquitous - Deterministic Telemetry and Hit Ratio)**: `THE SYSTEM shall expose a deep-frozen telemetry record containing hits, misses, evictions, stampedesCoalesced and expired counters, and shall compute hitRatio() as hits / (hits + misses), returning 0 when no accesses have occurred.`
- **FR-806 (Ubiquitous - Stable State Fingerprint)**: `THE SYSTEM shall compute stateFingerprint() as a SHA-256 over the alphabetically sorted names of currently live (unexpired) keys, such that two instances holding identical live key sets yield the same fingerprint.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-801 LRU Eviction Retains Most-Recently-Used Entry
  GIVEN a cache engine configured with maxEntries=2 and defaultTtlMs=1000
  WHEN keys "a" and "b" are set and then "a" is re-read before inserting "c"
  THEN "b" is evicted as the least-recently-used entry
  AND get("a") returns 1 and get("c") returns 3
  AND get("b") returns undefined
```

```gherkin
SCENARIO: BDD-802 Expired Entry Counts as a Miss and Increments Expiry Telemetry
  GIVEN a cache engine configured with a short-lived entry (ttlMs=1)
  WHEN the entry is read after its TTL has elapsed
  THEN get(key) returns undefined
  AND telemetry().expired is at least 1
  AND the access is counted in the miss total
```

```gherkin
SCENARIO: BDD-803 Singleflight Coalesces Concurrent Loads to One Backend Call
  GIVEN a cache engine and a loader that increments a backend-call counter
  WHEN three concurrent load("k", loader) calls are issued for the same missing key
  THEN all three promises resolve to the loaded value "V"
  AND the backend loader is invoked exactly once
  AND telemetry().stampedesCoalesced is at least 2
```

```gherkin
SCENARIO: BDD-804 State Fingerprint Is Stable Across Same-State Instances
  GIVEN two cache engines constructed with identical configuration
  WHEN both instances receive the same keys "x" and "y" with the same values
  THEN stateFingerprint() of both instances is identical
  AND the fingerprint is derived solely from the sorted live key set
```

## 4. Architecture Decision Records (ADRs)

- **ADR-171-1: Map insertion order as the LRU recency index**

  - _Context_: A bounded cache needs an eviction order with O(1) access and eviction, without auxiliary linked-list bookkeeping that introduces bugs.
  - _Decision_: Back the store with a JavaScript `Map` and treat insertion order as recency; on every successful `get`, delete and re-insert the key to move it to the tail, so `Map.keys().next().value` is always the LRU candidate.
  - _Consequence_: Eviction and promotion are O(1) and allocation-free; recency is only refreshed on read, so write-heavy workloads without reads retain insertion order rather than access order.

- **ADR-171-2: Lazy TTL evaluation instead of an active expiration sweep**
  - _Context_: An active background sweeper adds a timer and concurrency surface to a pure in-process module.
  - _Decision_: Evaluate expiry on read; an expired entry is deleted and its access recorded as an expired miss. `stateFingerprint()` additionally filters out unexpired-only keys so expired-but-unread entries never leak into the fingerprint.
  - _Consequence_: No timers or external dependencies are required and the module stays deterministic (Law V); memory held by never-again-read keys is only reclaimed on the next access or `clear()`.

## 5. Atomic Task DAG

1. [x] **TASK-171-1**: Author the SPEC-171 specification capturing the LRU, TTL, singleflight and telemetry contracts.
2. [x] **TASK-171-2**: Implement `EosCacheEngine` (bounded store, lazy TTL, singleflight `load`) in `src/core/eosCacheEngine.ts`.
3. [x] **TASK-171-3**: Implement deterministic `telemetry()`, `hitRatio()` and `stateFingerprint()` helpers over the live key set.
4. [x] **TASK-171-4**: Add BDD coverage for eviction, expiry, coalescing and fingerprint stability in `test/eosBigTechDataPlane.test.mjs`.
