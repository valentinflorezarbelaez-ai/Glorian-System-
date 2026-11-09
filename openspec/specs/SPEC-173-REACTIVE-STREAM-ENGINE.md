# SPEC-173: Reactive Stream Operator Engine — Push-Based Observables, Single-Terminal Semantics, and Backpressure Queue

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Reactive programming models (Project Reactor, RxJava, and the `java.util.concurrent.Flow` specification) treat data as asynchronous streams composed from small, stateless operators. Two properties are essential for correctness: the terminal-signal contract (a stream emits `onComplete` xor `onError` exactly once, after which no further values are delivered) and backpressure, which prevents a fast producer from overwhelming a slow consumer.

This specification governs `EosObservable` and `EosBoundedQueue` in `src/core/eosReactiveStreamEngine.ts`, the Layer 0 reactive primitives used across the EOS control plane. `EosObservable` provides push-based `subscribe`/`next`/`error`/`complete` with stateless `map`, `filter`, `take`, `tap` and `buffer` operators, a `collect()` terminal, and a static `merge` combinator; `EosBoundedQueue` provides demand-based bounded buffering with an explicit overflow policy.

The implementation is intentionally dependency-free (Law V) and synchronous-safe: subscribers live in a `Set`, operators build a downstream observable per stage, and termination is guarded by a single `terminated` flag so that post-terminal emissions are silently ignored rather than corrupting downstream state.

## 2. Functional Requirements (EARS Syntax)

- **FR-821 (Event-Driven - Value Propagation)**: `WHEN next(value) is invoked on a non-terminated observable, THE SYSTEM shall deliver value to every subscribed subscriber through its onNext handler.`
- **FR-822 (State-Driven - Single Terminal Signal)**: `WHILE an observable is terminated, subsequent next, error and complete calls shall be no-ops; the first error or complete call shall notify all subscribers through onError or onComplete, set isTerminated to true, and clear the subscriber set.`
- **FR-823 (Ubiquitous - Stateless Operators)**: `THE SYSTEM shall provide the stateless map, filter, tap and buffer operators, each returning a new EosObservable that applies its transformation as values arrive without mutating the source.`
- **FR-824 (Event-Driven - Bounded take Completion)**: `WHEN the take(n) operator has emitted n values, THE SYSTEM shall complete the output observable and unsubscribe from the source, ignoring any further source values.`
- **FR-825 (Event-Driven - Tail Buffer Flush)**: `WHEN a source consumed by buffer(size) completes with a non-empty partial chunk, THE SYSTEM shall emit that tail chunk before completing the output observable.`
- **FR-826 (Unwanted Condition - Bounded Queue Overflow)**: `IF a bounded queue is full or has been closed, THEN tryOffer(value) shall return false without mutating the queue, while poll() removes and returns the head element or undefined when empty.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-821 map Transforms Each Emitted Value
  GIVEN an EosObservable source and a mapped observable built with map(x => x * 2)
  WHEN the source emits 1, 2, 3 and then completes
  THEN the mapped observable collects [2, 4, 6]
  AND each source value is transformed exactly once
```

```gherkin
SCENARIO: BDD-822 filter Drops Non-Matching Values
  GIVEN an EosObservable source and an observable built with filter(x => x % 2 === 0)
  WHEN the source emits 1, 2, 3, 4, 5 and then completes
  THEN the filtered observable collects [2, 4]
  AND odd values are discarded downstream
```

```gherkin
SCENARIO: BDD-823 take Completes After N Values and Unsubscribes
  GIVEN an EosObservable source and an observable built with take(3)
  WHEN the source emits 1 through 10
  THEN the taken observable collects [1, 2, 3]
  AND the output completes as soon as the third value is delivered
```

```gherkin
SCENARIO: BDD-824 buffer Aggregates Fixed-Size Chunks and Flushes the Tail
  GIVEN an EosObservable source and an observable built with buffer(2)
  WHEN the source emits 1, 2, 3 and then completes
  THEN the buffered observable collects [[1, 2], [3]]
  AND the trailing partial chunk is emitted before completion
```

## 4. Architecture Decision Records (ADRs)

- **ADR-173-1: Single terminated flag enforcing the terminal-signal contract**

  - _Context_: Reactive streams must guarantee exactly one terminal signal; naive implementations re-notify subscribers or leak values after completion/error.
  - _Decision_: Guard `next`, `error` and `complete` with a single `terminated` boolean; the first terminal call notifies subscribers and clears the `Set`, and every later `next`/`error`/`complete` returns immediately.
  - _Consequence_: Post-terminal delivery is impossible and subscribers are released promptly, preventing memory retention on long-lived sources.

- **ADR-173-2: Pull-based collect() and an explicit bounded queue for backpressure**
  - _Context_: JavaScript has no native reactive backpressure; an unbounded push buffer can exhaust memory under a fast producer.
  - _Decision_: Provide `collect()` as a promise-based terminal for tests and batch consumers, and expose `EosBoundedQueue` whose `tryOffer` rejects values when the queue is full or closed, forcing an explicit overflow policy at the call site.
  - _Consequence_: Consumers control demand explicitly and memory stays bounded; producers must handle `false` from `tryOffer` rather than relying on automatic buffering.

## 5. Atomic Task DAG

1. [x] **TASK-173-1**: Author the SPEC-173 specification defining the propagation and terminal-signal contracts.
2. [x] **TASK-173-2**: Implement `EosObservable` with subscribe/next/error/complete and the single-terminal guarantee in `src/core/eosReactiveStreamEngine.ts`.
3. [x] **TASK-173-3**: Implement the stateless map, filter, take, tap, buffer operators plus `collect()` and the static `merge` combinator.
4. [x] **TASK-173-4**: Add BDD coverage for map, filter, take, buffer and bounded queue overflow in `test/eosBigTechDataPlane.test.mjs`.
