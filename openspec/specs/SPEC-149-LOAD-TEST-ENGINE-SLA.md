# SPEC-149: Synthetic Load Test Engine with SLA Assertions

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Performance regressions are invisible until they manifest under production traffic, and intuition about tail latency is unreliable. Verifiable engineering requires a repeatable synthetic workload that measures percentiles and asserts them against explicit Service Level Agreements. The module header of `src/core/eosLoadTestEngine.ts` cites the **Google PerfKit / k6 pattern** as the governing doctrine.

The `EosLoadTestEngine` executes a caller-supplied asynchronous target function under a configurable concurrency with a fixed total number of requests, an optional ramp-up duration and a per-request timeout. Each request's latency is recorded, and the engine aggregates a `LoadTestReport` containing success/error counts, error rate, throughput in requests per second, latency percentiles (p50/p95/p99, min, max, mean), per-metric SLA assertions, an overall pass flag and a SHA-256 receipt.

The approach is dependency-free and deterministic in structure: timeouts are enforced via `Promise.race` against a deadline, a shared cursor distributes work across workers, and SLA thresholds are evaluated only for the metrics the caller supplies. The engine never throws on target failure — failures are counted as errors so that the report is always produced.

## 2. Functional Requirements (EARS Syntax)

- **FR-581 (Ubiquitous - Concurrent Synthetic Workload Execution)**: The system shall execute exactly `config.totalRequests` invocations of the target function distributed across `config.concurrency` workers using a shared cursor, and shall report `totalRequests`, `successCount` and `errorCount` where successful and failed requests partition the total.
- **FR-582 (Event-Driven - Per-Request Timeout Enforcement)**: When `config.timeoutMs` is greater than 0 and the target function does not settle within that deadline, the system shall race the invocation against a timer that rejects with a `TIMEOUT` error and shall count the request as an error.
- **FR-583 (Ubiquitous - Latency Percentile Computation)**: The system shall record each request's rounded latency in milliseconds, sort them ascending, and compute `minMs`, `maxMs`, `meanMs`, `p50Ms`, `p95Ms` and `p99Ms` using index `min(floor(length * p), length - 1)` for the percentiles.
- **FR-584 (Ubiquitous - Throughput and Error Rate Derivation)**: The system shall compute `throughputRps` as `totalRequests / durationMs * 1000` (rounded to two decimals) and `errorRate` as `errorCount / totalRequests * 100` (rounded to two decimals).
- **FR-585 (Event-Driven - SLA Threshold Evaluation)**: When the caller supplies SLA thresholds, the system shall emit an assertion per supplied metric: `p50`, `p95`, `p99` and `errorRate` pass when the actual value is less than or equal to the threshold, while `throughput` passes when the actual value is greater than or equal to the threshold.
- **FR-586 (Ubiquitous - Immutable Report with Aggregate SLA Verdict)**: The system shall return a deep-frozen `LoadTestReport` whose `allSLAPassed` is true only if every emitted assertion passed, and which includes a `sha256Receipt` computed over the canonical summary of total requests, success count, error count, duration and overall pass flag.

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-581 Instant target executes the full workload and reports percentiles
  GIVEN a load test engine and an instant (no-op) target function
  WHEN run is invoked with concurrency 4, totalRequests 50, rampUpMs 0 and timeoutMs 5000
  THEN totalRequests equals 50, successCount equals 50 and errorCount equals 0
  AND throughputRps is greater than 0
  AND the reported latency.minMs equals 0
```

```gherkin
SCENARIO: BDD-582 Slow target exceeds the timeout and every request is counted as an error
  GIVEN a load test engine and a target that resolves after 200ms
  WHEN run is invoked with concurrency 2, totalRequests 4 and timeoutMs 50
  THEN errorCount equals 4
  AND the reported errorRate is greater than or equal to 100
```

```gherkin
SCENARIO: BDD-583 Fast target satisfies aggressive SLA thresholds
  GIVEN a load test engine and an instant target function
  WHEN run is invoked with concurrency 2, totalRequests 20, timeoutMs 1000 and SLA thresholds { p99: 50, errorRate: 1 }
  THEN the report's allSLAPassed flag is true
```

## 4. Architecture Decision Records (ADRs)

- **ADR-149-1: Errors are measured, never thrown**

  - _Context_: A load test is only useful if it always yields a report, even when the target is degraded or fully failing.
  - _Decision_: Catch target rejections and timeout races inside the worker, increment `errorCount` and continue, producing an `errorRate` that SLA assertions can evaluate.
  - _Consequence_: The engine cannot abort mid-run on failure, gaining total-report guarantees at the cost of masking target exceptions (which are surfaced only as counts).

- **ADR-149-2: Only caller-supplied SLA metrics are asserted**
  - _Context_: Different call sites care about different service levels, and imposing implicit thresholds would produce false failures.
  - _Decision_: Emit an assertion per metric present in the threshold map, using `<=` for latency/errorRate and `>=` for throughput, and derive `allSLAPassed` from the emitted set.
  - _Consequence_: The verdict is exactly the caller's definition of success, keeping the engine policy-free.

## 5. Atomic Task DAG

1. [x] **TASK-149-1**: Author this specification defining FR-581..FR-586 and BDD-581..BDD-584 for synthetic load testing.
2. [x] **TASK-149-2**: Implement `src/core/eosLoadTestEngine.ts` with `EosLoadTestEngine.run`, timeout handling and SLA evaluation.
3. [x] **TASK-149-3**: Implement BDD tests `BDD-480`..`BDD-482` in `test/eosBigTechObservability.test.mjs` (`describe("SPEC-149: ...")`).
