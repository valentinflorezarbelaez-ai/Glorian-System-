# SPEC-145: Multi-Window SLO Error-Budget Governor Gate

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

CI reliability is an availability signal. `EosSLOErrorBudgetGovernor` (`src/core/eosSLOErrorBudgetGovernor.ts`) monitors the pipeline's test pass-rate as an SLO proxy metric and blocks merges when the error budget is exhausted, applying the Google SRE multi-window burn-rate standard cited in the module header (Google SRE Workbook, Chapter 4).

The SLO target is a 99.5% test pass rate over a rolling 30-day error budget. Each CI run is appended to an append-only JSONL state file (`slo-events.jsonl`) as pass/fail counts, and evaluation recomputes burn rates independently per window (1h-fast at 14.4x, 6h-medium at 6x, 3d-slow at 1x). The gate verdict follows the fast-burn rule: a fast-window breach is an immediate BLOCK, while only slower-window breaches downgrade to WARN.

The governor stays dependency-free under Law V, importing only Node built-ins and the `eosKernelPrimitives.ts` helpers, and emits a frozen status report with a deterministic SHA-256 receipt for downstream evidence capture.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-541 (Ubiquitous - Multi-Window Burn-Rate Computation)**: `The system shall compute, for each configured window, the burn rate as the window error rate divided by the target error rate derived from the configured target availability.`
- **FR-542 (Event-Driven - CI Event Recording)**: `When a CI run event with a positive total test count is recorded, the system shall append it to the append-only JSONL state file and reject a non-positive total.`
- **FR-543 (State-Driven - Rolling Error Budget)**: `While evaluating, the system shall count only events inside the configured budget-day horizon and derive the total, consumed, and remaining error budget from those events.`
- **FR-544 (Unwanted Condition - Fast Burn)**: `If the fast 1h window burn rate strictly exceeds its threshold, then the system shall return a BLOCK gate verdict.`
- **FR-545 (Unwanted Condition - Slow Burn)**: `If only slower windows breach their thresholds, then the system shall return a WARN gate verdict instead of a BLOCK.`
- **FR-546 (Ubiquitous - Deterministic SLO Receipt)**: `The system shall emit a deterministic SHA-256 receipt over the aggregate SLO state, such that identical events yield identical receipts.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-541 Pass verdict when every test passes
GIVEN a governor with the default SLO configuration and two fully-passing CI events
WHEN the governor evaluates the SLO state
THEN the gate verdict is PASS
AND the remaining error budget is one hundred percent
```

```gherkin
SCENARIO: BDD-542 Warn verdict on slow burn
GIVEN a governor with the default SLO configuration
WHEN a CI event records a three-percent error rate
THEN the aggregate budget is no longer full
AND the overall state is breached
AND the gate verdict is WARN or BLOCK
```

```gherkin
SCENARIO: BDD-543 Block verdict driven by the fast window
GIVEN a governor with the default SLO configuration
WHEN a CI event records a twenty-percent error rate in the fast window
THEN the fast 1h burn rate strictly exceeds its threshold
AND the gate verdict is BLOCK
```

```gherkin
SCENARIO: BDD-544 Exact budget arithmetic and boundary handling
GIVEN a governor with the default SLO configuration
WHEN an event records two failures out of one thousand tests
THEN the total budget is five, the consumed budget is two, the remaining budget is three, and the remaining percentage is sixty
AND an exhausted budget is clamped to zero remaining and zero percent
AND an empty state reports one hundred percent and PASS
```

---

## 4. Architecture Decision Records (ADRs)

- **ADR-145-1: Google SRE multi-window burn-rate instead of a single threshold**

  - _Context_: A single global error-rate threshold either pages too late for fast outages or too noisily for slow degradations.
  - _Decision_: Evaluate independent fast, medium, and slow windows with their own burn multipliers, and let the fast window alone escalate to BLOCK while slower windows escalate to WARN.
  - _Consequence_: Fast outages block immediately and slow burns raise a warning; the trade-off is that three windows must be configured and reasoned about.

- **ADR-145-2: Append-only JSONL state under the working directory**
  - _Context_: Rolling budgets need durable, inspectable history without a database dependency.
  - _Decision_: Append one JSON event per CI run to `slo-events.jsonl` (defaulting to `.eos/` under the current directory) and recompute the budget from the time-filtered event set on every evaluation.
  - _Consequence_: State is transparent and dependency-free; the trade-off is that the file grows unbounded and old events are only excluded by the horizon filter.

---

## 5. Atomic Task DAG

1. [x] **TASK-145-1**: Author this specification (EARS requirements, BDD scenarios, ADR) and link it to the module header.
2. [x] **TASK-145-2**: Implement `EosSLOErrorBudgetGovernor` (`src/core/eosSLOErrorBudgetGovernor.ts`) with the default SLO config and event recording.
3. [x] **TASK-145-3**: Implement the rolling budget arithmetic, per-window burn-rate computation, and gate verdict logic.
4. [x] **TASK-145-4**: Add `test/eosSLOErrorBudgetGovernor.test.mjs` covering every BDD scenario, including boundary and clamping cases.
