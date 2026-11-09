# SPEC-177: Hashed Timing Wheel Scheduler

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

The EOS agent runtime schedules a large volume of short-lived timers — retry backoffs, gossip probe intervals, deadline enforcement and cache expiry — and cannot afford the O(log N) cost per insert/remove that a binary-heap priority queue incurs. The `eosHashedTimingWheel` Layer-0 module implements the hashed timing wheel popularized by Netty's `HashedWheelTimer` and by Kafka's internal delay queue: every deadline tick is hashed into a fixed-circumference array of slots, so that registration and cancellation are O(1) irrespective of the number of pending timers.

The wheel is virtual and deterministic. There is no dependency on the real wall clock; time advances only when the host explicitly invokes `advance(ticks)`. This makes scheduling reproducible and trivially testable. A timer whose deadline lies past the wheel circumference is retained for the required number of full rotations (`rounds = floor(deltaTicks / slots)`) and fires on its exact `deadlineTick`.

The module honours Law V (Zero External Runtime Dependencies): it relies only on `node:` built-ins plus `pureSha256` and `deepFreeze` from `src/core/eosKernelPrimitives.ts`, and uses string-literal union types rather than TypeScript `enum`. Constructor and public entry points are guarded with `assertPrecondition`, and every emitted snapshot is `deepFreeze`d to preserve immutability.

## 2. Functional Requirements (EARS Syntax)

- **FR-861 (Ubiquitous - Slot-Hashed O(1) Registration)**: `The system shall register one-shot and recurring timers in O(1) time by hashing each computed deadline tick into a slot index (deadlineTick % slots) over a wheel configured with at least two slots and a positive tick duration.`

- **FR-862 (Event-Driven - Exact Deadline Firing)**: `WHEN the wheel advances a tick, the system shall fire every non-cancelled timer whose rounds counter has reached zero at that tick, and shall swallow any exception thrown by a user callback so that a single faulty timer cannot stall the wheel.`

- **FR-863 (State-Driven - Multi-Round Overflow)**: `WHILE a scheduled deadline lies beyond the wheel circumference, the system shall retain that timer across floor(deltaTicks / slots) full rotations, decrementing its rounds counter on each matching tick, and shall fire it only at its exact deadline tick.`

- **FR-864 (Event-Driven - Recurring Reschedule)**: `WHEN a recurring timer fires, the system shall atomically reschedule it at currentTick + intervalTicks, enforcing that the interval is not shorter than the configured tick duration.`

- **FR-865 (Event-Driven - O(1) Cancellation)**: `WHEN cancel(handle) is invoked for a live timer, the system shall mark it cancelled, increment the cancellation counter, guarantee it never fires, and return true; for an unknown or already-cancelled handle it shall return false without mutating state.`

- **FR-866 (Ubiquitous - Deterministic Telemetry and Fingerprint)**: `The system shall expose telemetry counters (scheduled, fired, cancelled, pending) and a SHA-256 fingerprint over the ordered set of live (id, deadlineTick) pairs, both derived solely from the virtual clock so that identical schedules produce identical fingerprints.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-861 One-Shot Timer Fires Exactly At Its Deadline Tick
  GIVEN a wheel with 8 slots and a tick duration of 10ms
  WHEN a one-shot timer is scheduled 30ms in the future and the wheel advances 2 ticks
  THEN the callback has not fired yet
  AND when the wheel advances the 3rd tick the callback fires exactly once

SCENARIO: BDD-862 Cancellation Prevents Firing and Is Counted
  GIVEN a wheel with 8 slots and a tick duration of 10ms
  WHEN a timer scheduled 50ms ahead is cancelled before it is due and the wheel advances 10 ticks
  THEN the callback is never invoked
  AND telemetry reports exactly 1 cancelled timer

SCENARIO: BDD-863 Overflow Survives Far-Future Deadlines
  GIVEN a wheel with only 4 slots and a tick duration of 10ms
  WHEN a deadline 70ms ahead (7 ticks, one full rotation) is scheduled and the wheel advances 6 ticks
  THEN the callback has not fired
  AND the callback fires after the 7th tick

SCENARIO: BDD-864 Recurring Timer Reschedules on Each Interval
  GIVEN a wheel with 8 slots and a tick duration of 10ms
  WHEN a recurring timer with a 20ms initial delay and a 30ms interval is scheduled
  THEN after 2, 5 and 8 ticks the callback has fired exactly 1, 2 and 3 times respectively
```

## 4. Architecture Decision Records (ADRs)

- **ADR-177-1: Virtual Deterministic Clock Instead of Wall-Clock Timers**

  - _Context_: Heap-based `setTimeout` scheduling is non-deterministic and untestable, and coupling the wheel to the system clock would make BDD scenarios flaky.
  - _Decision_: Time is advanced exclusively through the explicit `advance(ticks)` method, keeping the current tick a pure integer counter internal to the wheel.
  - _Consequence_: Fully reproducible tests and fingerprints, at the cost of requiring callers to drive the clock.

- **ADR-177-2: Slot Array of Buckets With Per-Timer Rounds Counters**
  - _Context_: Deadlines may exceed the wheel circumference, and a naive modulo-only wheel would fire them prematurely.
  - _Decision_: Each slotted timer carries a `rounds` counter computed as `floor(deltaTicks / slots)`; the bucket is only eligible to fire once `rounds` reaches zero.
  - _Consequence_: O(1) registration/cancellation is preserved for arbitrary deadlines, accepting one extra integer per pending timer.

## 5. Atomic Task DAG

1. [x] **TASK-177-1**: Author this SPEC (EARS + BDD) and freeze the EARS keywords and slot-hashing semantics.
2. [x] **TASK-177-2**: Implement `EosHashedTimingWheel` in `src/core/eosHashedTimingWheel.ts` (slot hashing, rounds, recurring reschedule, cancellation, telemetry, fingerprint).
3. [x] **TASK-177-3**: Add the `node:test` suite covering every BDD scenario (one-shot, cancellation, overflow, recurring) in `test/eosBigTechCoordination.test.mjs`.
4. [x] **TASK-177-4**: Verify Layer-0 purity (zero external dependencies) and that regenerated snapshots are deep-frozen.
