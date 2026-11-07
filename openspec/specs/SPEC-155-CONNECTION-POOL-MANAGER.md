# SPEC-155: Connection Pool Manager with Adaptive Sizing, Leak Detection and FIFO Fairness

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Every persistent resource in the EOS control plane — sockets, worker leases, database handles — must be recycled rather than created per call, otherwise churn exhausts the file-descriptor budget and latency degrades under load. Simultaneously, an unbounded pool risks silently leaking connections that were leased but never returned, starving all subsequent consumers.

The design follows the production pattern of HikariCP and Google's adaptive pooling: reuse idle connections first, grow the pool up to a bounded maximum, and queue excess demand fairly. The `EosConnectionPoolManager` encodes these rules, including a lease timeout so that a saturated pool fails fast rather than deadlocking callers.

The manager also provides deterministic leak detection: any connection held longer than the configured threshold is reported with a stable, frozen fingerprint, and the pool exposes an aggregate statistics snapshot. The implementation remains dependency-free per Law V.

## 2. Functional Requirements (EARS Syntax)

- **FR-641 (Ubiquitous - Idle Connection Reuse)**: `The EOS Connection Pool Manager shall, on acquire, return an existing idle connection when one is available, marking it leased before returning its identifier.`
- **FR-642 (Event-Driven - Bounded Pool Growth)**: `When no idle connection exists and the total connection count is below the configured maximum size, the system shall create a new connection, lease it, and return its identifier.`
- **FR-643 (State-Driven - FIFO Fair Waiting Queue)**: `While the pool is at maximum size, the system shall enqueue the acquire request in a first-in-first-out wait queue and serve the oldest waiting caller when a connection is released.`
- **FR-644 (Unwanted Condition - Lease Timeout Backpressure)**: `If a queued acquire request waits longer than leaseTimeoutMs without a release, then the system shall remove the waiter from the queue and reject it with a LEASE_TIMEOUT error.`
- **FR-645 (Event-Driven - Deterministic Leak Detection)**: `When leak detection is invoked, the system shall return a frozen list of connection identifiers whose lease age exceeds leakDetectionThresholdMs and increment the cumulative leaksDetected counter by the number of leaked connections found.`
- **FR-646 (Unwanted Condition - Drain Rejects All Waiters)**: `If the pool is drained, then the system shall reject every queued waiter with a POOL_DRAINING error and clear both the wait queue and the connection list.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-641 Creates connections up to max
GIVEN an EosConnectionPoolManager with maxSize 3
WHEN 3 successful acquires are performed
THEN the pool statistics report 3 active connections
AND the pool statistics report 3 total connections

SCENARIO: BDD-642 Release makes a connection available again
GIVEN an EosConnectionPoolManager with maxSize 2
WHEN a connection is acquired, released, and then acquired again
THEN the second acquire returns the same connection identifier that was released

SCENARIO: BDD-643 Drain rejects all waiters
GIVEN an EosConnectionPoolManager with maxSize 1 whose single connection is already leased
WHEN a second acquire waits in the queue and the pool is drained
THEN the waiting acquire promise rejects with a POOL_DRAINING error

SCENARIO: BDD-644 Lease timeout rejects a queued acquire
GIVEN a saturated EosConnectionPoolManager with a short leaseTimeoutMs
WHEN a queued acquire is not served before the timeout elapses
THEN the acquire promise rejects with a LEASE_TIMEOUT error
AND the waiter is removed from the pool statistics waiting count
```

## 4. Architecture Decision Records (ADRs)

- **ADR-155-1: Reuse-first, grow-second, queue-last acquisition policy**
  - _Context_: Creating a connection per call is wasteful, while growing without bound risks resource exhaustion.
  - _Decision_: Acquire prefers idle connections, then grows the pool only up to maxSize, and finally queues the caller.
  - _Consequence_: Steady-state load reuses a warm pool, rare spikes grow it predictably, and saturation degrades to queuing rather than unbounded allocation.
- **ADR-155-2: Timeout and drain instead of indefinite blocking**
  - _Context_: A saturated or shutting-down pool that blocks forever converts a resource shortage into a caller deadlock.
  - _Decision_: Reject waiters after leaseTimeoutMs (LEASE_TIMEOUT) and reject all waiters on drain (POOL_DRAINING).
  - _Consequence_: Callers receive prompt, typed backpressure signals instead of hanging; shutdown is deterministic.

## 5. Atomic Task DAG

1. [x] **TASK-155-1**: Author SPEC-155 with EARS requirements FR-641..FR-646 and BDD scenarios BDD-641..BDD-644.
2. [x] **TASK-155-2**: Implement the `EosConnectionPoolManager` module (idle reuse, bounded growth, FIFO queue, leak detection, drain).
3. [x] **TASK-155-3**: Add unit tests covering growth to max, release and reuse, and drain rejection.
4. [x] **TASK-155-4**: Integrate the scenario into the Big Tech Resilience test suite and confirm zero external dependencies.
