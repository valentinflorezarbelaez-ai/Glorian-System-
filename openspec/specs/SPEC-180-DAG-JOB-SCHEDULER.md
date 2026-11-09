# SPEC-180: DAG Job Scheduler

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Multi-step EOS pipelines (build → test → package → deploy) are naturally expressed as directed acyclic graphs of jobs with dependencies. The `eosDagJobScheduler` Layer-0 module implements the execution model used by Apache Airflow and Spark's DAG scheduler: a Kahn topological sort determines the legal order, independent nodes run in bounded parallel waves, and a node failure isolates its blast radius by skipping all downstream dependents.

Correctness hinges on two guarantees. First, no node may start before all of its dependencies have completed successfully; nodes with an unsatisfiable (failed or cyclic) dependency are marked `SKIPPED` rather than silently executed. Second, execution must be deterministic: ties in the topological ordering are broken lexicographically, and each node's retry uses a bounded exponential backoff (`min(2^a, 4)`) up to its declared `maxRetries`.

The module honours Law V (Zero External Runtime Dependencies): it uses only `pureSha256`, `deepFreeze` and `assertPrecondition` from `src/core/eosKernelPrimitives.ts`, forbids TypeScript `enum` in favour of a string-literal `NodeStatus` union, and exposes a deterministic execution-trace fingerprint.

## 2. Functional Requirements (EARS Syntax)

- **FR-891 (Ubiquitous - Node Registration)**: `The system shall register DAG nodes carrying a unique id, a dependency list and a maxRetries of at least one, rejecting duplicate ids and freezing each node on insertion.`

- **FR-892 (Event-Driven - Topological Ordering)**: `WHEN topoOrder is requested, the system shall produce a Kahn topological ordering in which every dependency precedes its dependents, breaking ties lexicographically for determinism.`

- **FR-893 (Unwanted Condition - Cycle Detection)**: `IF the dependency graph contains a cycle, THEN the system shall abort the ordering with a "Cycle detected in DAG" error instead of returning a partial or unsafe order.`

- **FR-894 (State-Driven - Bounded Parallel Execution)**: `WHILE executing the DAG, the system shall run only the nodes whose dependencies have completed, in waves capped at the configured maxParallel (default 4), until every node has settled.`

- **FR-895 (Event-Driven - Retry With Bounded Backoff)**: `WHEN a node run fails, the system shall retry it up to maxRetries times applying a bounded exponential backoff of min(2^attempt, 4) milliseconds, marking the node DONE on the first success and FAILED after exhausting all retries.`

- **FR-896 (Unwanted Condition - Failure Isolation)**: `IF a node ends FAILED, THEN the system shall mark every downstream node that depends on it as SKIPPED and report the overall result with ok = false.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-891 Topological Order Respects Dependencies
  GIVEN a DAG with node "a" (no deps), node "b" depending on "a" and node "c" depending on ["a","b"]
  WHEN the topological order is requested
  THEN "a" appears before "b"
  AND "b" appears before "c"

SCENARIO: BDD-892 Cyclic Dependencies Are Rejected
  GIVEN a DAG whose nodes form a cycle a -> c -> b -> a
  WHEN the topological order is requested
  THEN the scheduler throws an error matching "Cycle detected"

SCENARIO: BDD-893 Downstream of a Failed Node Is SKIPPED
  GIVEN a DAG where node "a" always throws and node "b" depends on "a"
  WHEN the DAG is executed
  THEN the overall result is not ok
  AND the result for "a" is FAILED
  AND the result for "b" is SKIPPED

SCENARIO: BDD-894 Retry Eventually Succeeds Within the Retry Budget
  GIVEN a node configured with maxRetries = 3 whose run throws on the first attempt and succeeds on the second
  WHEN the DAG is executed
  THEN the DAG completes successfully
  AND the node reports exactly 2 attempts
```

## 4. Architecture Decision Records (ADRs)

- **ADR-180-1: Kahn's Algorithm With Lexicographic Tie-Breaking**

  - _Context_: DFS-based topological sorts are harder to make deterministic and to detect cycles unambiguously at execution time.
  - _Decision_: Use Kahn's indegree-queue algorithm, keeping the ready queue sorted so that the emitted order is reproducible.
  - _Consequence_: Deterministic, cycle-detecting ordering that supports the execution-trace fingerprint, at the cost of an incremental sort per wave.

- **ADR-180-2: Failure Isolation via SKIPPED Rather Than Propagated Errors**
  - _Context_: Aborting the whole DAG on the first failure would waste already-completable independent branches.
  - _Decision_: A failed node marks only its transitive dependents as SKIPPED; unrelated branches still execute, and the aggregate `ok` flag reports `failed.size === 0`.
  - _Consequence_: Maximum useful work per run and a precise blast-radius report, at the cost of a non-throwing failure representation.

## 5. Atomic Task DAG

1. [x] **TASK-180-1**: Author this SPEC (EARS + BDD) formalising topological ordering, retry and failure-isolation semantics.
2. [x] **TASK-180-2**: Implement `EosDagJobScheduler` in `src/core/eosDagJobScheduler.ts` (add, topoOrder, wave execution, retry/backoff, SKIPPED isolation, trace fingerprint).
3. [x] **TASK-180-3**: Add the `node:test` suite covering every BDD scenario (topo order, cycle, failure isolation, retry, parallelism cap) in `test/eosBigTechCoordination.test.mjs`.
4. [x] **TASK-180-4**: Verify Layer-0 purity (zero external dependencies) and that all emitted results are deep-frozen.
