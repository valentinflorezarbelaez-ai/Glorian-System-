# SPEC-146: Statistical Performance Regression Detection Gate

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

A passing suite can still be silently getting slower. `EosPerformanceRegressionTracker` (`src/core/eosPerformanceRegressionTracker.ts`) stores a timing baseline for each test suite and detects regressions using Google's statistical approach, failing the pipeline when a suite exceeds a multiple of its historical p95 duration, as described in the module header.

Samples are appended to an append-only JSONL baseline (`perf-baseline.jsonl`), one timestamped, rounded duration per suite per run. Detection compares the current (or latest) duration against a per-suite p95 baseline: once at least five samples exist the p95 percentile is used, otherwise the maximum of the available samples serves as a conservative baseline, and a suite with no history cannot regress.

The tracker remains dependency-free under Law V, importing only Node built-ins and the `eosKernelPrimitives.ts` `deepFreeze` helper, and every regression report is returned frozen so downstream consumers cannot mutate shared state.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-551 (Ubiquitous - Timing Baseline Persistence)**: `The system shall persist per-suite timing samples to an append-only JSONL baseline file and reload them on construction.`
- **FR-552 (Event-Driven - Sample Recording)**: `When a suite duration is recorded, the system shall round it, timestamp it, append it to the baseline, and retain it in memory.`
- **FR-553 (State-Driven - p95 Baseline Selection)**: `While at least five samples exist for a suite, the system shall use the p95 percentile as the baseline; otherwise it shall use the maximum of the available samples.`
- **FR-554 (Unwanted Condition - Regression Detected)**: `If the current duration exceeds the baseline by more than the threshold ratio, then the system shall flag the suite as regressed.`
- **FR-555 (Event-Driven - Bulk Regression Check)**: `When a bulk check runs, the system shall compare each suite's latest sample against the p95 of all its prior samples and return only the regressed suites.`
- **FR-556 (Unwanted Condition - Absent Baseline)**: `If no baseline samples exist for a suite, then the system shall report a ratio of one and no regression.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-551 No baseline means no regression
GIVEN a tracker with no recorded samples for a suite
WHEN a regression check runs for that suite
THEN the report shows no regression
AND the ratio is one
```

```gherkin
SCENARIO: BDD-552 Stable timings stay near ratio one
GIVEN ten samples recorded for a suite with near-constant durations
WHEN a check runs with a current duration close to the samples
THEN the ratio stays well below the one-and-a-half mark
AND no regression is reported
```

```gherkin
SCENARIO: BDD-553 A three-times spike triggers a regression
GIVEN ten samples recorded at a constant duration
WHEN a check runs with a current duration about three times the baseline
THEN the ratio exceeds two
AND the suite is flagged as regressed
AND the p95 baseline uses the percentile once at least five samples exist
```

```gherkin
SCENARIO: BDD-554 Bulk check returns only regressed suites
GIVEN two suites, one stable and one spiking to two-and-a-half times its baseline
WHEN a bulk check runs with a threshold of two
THEN at least one regression is returned
AND every returned entry is flagged as regressed
```

---

## 4. Architecture Decision Records (ADRs)

- **ADR-146-1: p95 percentile baseline with a threshold ratio**

  - _Context_: A mean-based comparison is sensitive to outliers and produces noisy, hard-to-action regressions.
  - _Decision_: Compare the current duration against a per-suite p95 baseline once enough samples exist (falling back to the maximum), and flag a regression when the ratio strictly exceeds the configured threshold.
  - _Consequence_: Detection tolerates occasional slow runs while still catching sustained slowdowns; the trade-off is that a sustained but sub-threshold drift is not flagged.

- **ADR-146-2: Append-only JSONL baseline without a database**
  - _Context_: Baselines must persist across CI invocations without a database or external service.
  - _Decision_: Store samples as newline-delimited JSON in `perf-baseline.jsonl` (defaulting to `.eos/` under the current directory) and reconstruct the in-memory sample list on construction.
  - _Consequence_: Persistence is transparent, portable, and dependency-free; the trade-off is that the file grows unbounded and duplicates must be managed by the caller.

---

## 5. Atomic Task DAG

1. [x] **TASK-146-1**: Author this specification (EARS requirements, BDD scenarios, ADR) and link it to the module header.
2. [x] **TASK-146-2**: Implement `EosPerformanceRegressionTracker` (`src/core/eosPerformanceRegressionTracker.ts`) with baseline persistence and sample recording.
3. [x] **TASK-146-3**: Implement the p95 baseline selection, single-suite and bulk regression checks, and frozen report output.
4. [x] **TASK-146-4**: Add `test/eosPerformanceRegressionTracker.test.mjs` covering every BDD scenario, including the no-baseline and p95 boundary cases.
