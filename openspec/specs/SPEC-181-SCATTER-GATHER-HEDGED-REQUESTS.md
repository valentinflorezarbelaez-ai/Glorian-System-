# SPEC-181: Scatter-Gather With Hedged Requests

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

At scale, the tail latency of a fan-out dominates the whole operation: waiting for the slowest replica is often many times slower than the median. The `eosScatterGatherHedger` Layer-0 module implements the hedged-request technique described in Google's _The Tail at Scale_ and used by Spanner-style replicated reads: dispatch a primary attempt to every replica, gather the first `requiredSuccesses` results, and launch speculative duplicate (hedged) copies only when the observation window suggests a straggler.

Two safety properties shape the implementation. First, hedges are delayed by `clamp(hedgeDelayMs, 1, p95Ms)` so the engine never doubles fleet load until it has evidence of tail latency (cold start uses 0, so `hedgeDelayMs` bounds the wait). Second, once enough results are gathered the engine cancels all redundant in-flight signals and clears the threshold poller so no leaked interval keeps the Node event loop alive.

The module honours Law V (Zero External Runtime Dependencies): it depends only on `pureSha256`, `deepFreeze` and `assertPrecondition` from `src/core/eosKernelPrimitives.ts`, uses string-literal types (no `enum`), and exposes deterministic attempt accounting, a rolling p95 over the last 100 runs and a SHA-256 attempt fingerprint.

## 2. Functional Requirements (EARS Syntax)

- **FR-901 (Ubiquitous - Scatter Fanout)**: `The system shall, on each run, fan out a primary attempt concurrently to every configured replica, requiring at least one replica and a requiredSuccesses threshold in the range [1, replicas.length].`

- **FR-902 (Event-Driven - Threshold Fan-In)**: `WHEN at least requiredSuccesses values have been collected, the system shall resolve the gather early and merge the first requiredSuccesses values through the supplied reducer function.`

- **FR-903 (Event-Driven - Total Deadline Enforcement)**: `WHEN the totalDeadlineMs elapses before the threshold is met, the system shall stop gathering, cancel all in-flight signals and report ok = false if fewer than requiredSuccesses values were collected.`

- **FR-904 (State-Driven - p95-Based Hedge Delay)**: `WHILE a prior p95 latency has been observed, the system shall delay hedged duplicate attempts by clamp(hedgeDelayMs, 1, p95Ms) so redundant load is not introduced before tail latency is evidenced.`

- **FR-905 (Event-Driven - Redundant Cancellation)**: `WHEN a winner is settled, the system shall mark every outstanding attempt's signal cancelled and clear the threshold poller, guaranteeing no leaked interval keeps the process alive.`

- **FR-906 (Ubiquitous - Deterministic Telemetry)**: `The system shall record per-attempt records (replica, hedged flag, start/finish timings, ok) and expose a p95 latency over the last 100 runs plus a SHA-256 fingerprint over attempt timings.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-901 Required-Successes Fan-In Threshold Triggers
  GIVEN a scatter-gather engine over replicas ["a","b","c"] with requiredSuccesses = 2
  WHEN the run gathers values from the replicas and merges the first two successes
  THEN the result is ok
  AND the merged value is composed of exactly 2 gathered parts

SCENARIO: BDD-902 Fast Replicas Beat the Deadline Even If One Hangs
  GIVEN an engine over replicas ["fast","slow","medium"] where "slow" blocks far beyond the deadline
  WHEN the run executes with a bounded totalDeadlineMs
  THEN the gather still succeeds because the fast replicas satisfy the threshold in time

SCENARIO: BDD-903 All Replicas Failing Yields ok = false
  GIVEN an engine whose every replica throws
  WHEN the run executes
  THEN the result is not ok
  AND at least two attempts were recorded

SCENARIO: BDD-904 p95 Tracking Warms Up Across Runs
  GIVEN an engine that completes at least one run
  WHEN the p95 accessor is queried after several runs
  THEN it returns a non-negative finite latency value
```

## 4. Architecture Decision Records (ADRs)

- **ADR-181-1: Race of Threshold, Deadline and Full Fanout**

  - _Context_: Blocking until all replicas answer defeats the purpose of tail-latency mitigation; a fixed timeout alone would be either too slow or too aggressive.
  - _Decision_: The gather is resolved by `Promise.race` between "all primaries finished", a total-deadline timer and a 1ms threshold poller that fires once `requiredSuccesses` is reached.
  - _Consequence_: Early return on sufficient evidence while still bounded by a hard deadline, at the cost of a lightweight polling interval.

- **ADR-181-2: p95-Gated Hedge Launch**
  - _Context_: Launching hedges eagerly can multiply backend load and trigger cascading overload.
  - _Decision_: Hedge copies are launched only after `clamp(hedgeDelayMs, 1, p95Ms)`, and the threshold poller plus all signals are torn down in a `finally` block.
  - _Consequence_: Bounded speculative load and no leaked timers, accepting a warm-up period before p95 is meaningful.

## 5. Atomic Task DAG

1. [x] **TASK-181-1**: Author this SPEC (EARS + BDD) formalising the fan-in threshold, deadline race and hedge-delay rule.
2. [x] **TASK-181-2**: Implement `EosScatterGatherEngine` in `src/core/eosScatterGatherHedger.ts` (primary fanout, threshold/deadline race, hedge wave, cancellation, p95, fingerprint).
3. [x] **TASK-181-3**: Add the `node:test` suite covering every BDD scenario (threshold, deadline with a straggler, all-fail, p95 warm-up, single replica) in `test/eosBigTechCoordination.test.mjs`.
4. [x] **TASK-181-4**: Verify Layer-0 purity (zero external dependencies) and that interval teardown prevents any leaked event-loop handle.
