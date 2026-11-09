# SPEC-131: Deterministic Flaky-Test Quarantine Gate

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

A test that passes and fails on the _same_ revision carries no signal: it is non-deterministic, and a green pipeline built on it can lie. The `EosFlakyTestQuarantine` Layer-0 engine (`src/core/eosFlakyTestQuarantine.ts`) plus its `scripts/flaky-gate.mjs` wiring fold N repeated runs of an unchanged suite into a per-test classification and emit a deterministic receipt, implementing the Google TAP flakiness dashboard and Meta's "quarantine with a budget" policy cited in the module header.

Detected flakiness is surfaced, never hidden. Known-flaky tests live in an explicit, shrinking quarantine (`docs/quality/flaky-budget.json`) and any _new_ flakiness fails the gate. New flakiness is never auto-added and an expiry is never auto-extended, so a regression can neither be quarantined nor renewed away silently.

The approach is deliberately bounded and dependency-free (Law V): the engine imports only `eosKernelPrimitives.ts` primitives (`assertPrecondition`, `deepFreeze`, `pureSha256`), and the gate executes the suite through Node's native `--test --test-reporter=junit` reporter. Every quarantine entry is tracked debt carrying a human owner and an ISO expiry date, which forces the list to stay honest and to shrink over time.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-501 (Ubiquitous - Deterministic Classification)**: `The system shall classify each observed test over N repeated runs of an unchanged revision as exactly one of stable-pass, stable-fail, or flaky.`
- **FR-502 (Event-Driven - Repeated Suite Execution)**: `When the flaky gate runs a suite for a configured number of repetitions, the system shall parse one JUnit report per repetition into per-test verdicts and fold them into a single report.`
- **FR-503 (State-Driven - Minimum Run Threshold)**: `While fewer than the configured minimum number of repetitions exist, the system shall reject the classification instead of reporting a verdict.`
- **FR-504 (Unwanted Condition - New Flakiness)**: `If a test is classified flaky but is not present in the quarantine, then the system shall raise a NEW_FLAKY violation.`
- **FR-505 (Unwanted Condition - Stale or Expired Quarantine)**: `If a quarantined test is no longer flaky or has passed its expiry date, then the system shall raise a STALE_QUARANTINE or EXPIRED_QUARANTINE violation respectively.`
- **FR-506 (Ubiquitous - Cryptographic Receipt)**: `The system shall emit a deterministic SHA-256 receipt over the classification report, such that identical runs yield identical receipts.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-501 Deterministic versus flaky classification
GIVEN a quarantine engine with the default minimum of two runs
WHEN a test passes in every run
THEN the engine classifies it as stable-pass with a flaky count of zero
AND when a test both passes and fails across the runs the engine classifies it as flaky
```

```gherkin
SCENARIO: BDD-502 Inconsistent presence is flakiness
GIVEN a quarantine engine with three runs
WHEN a test is reported in only two of the three runs
THEN the engine classifies it as flaky
AND its observed-run count is lower than the total run count
```

```gherkin
SCENARIO: BDD-503 New flakiness fails the gate
GIVEN a quarantine budget that does not list a flaky test
WHEN the flaky gate evaluates the classification against the budget
THEN a NEW_FLAKY violation is raised for that test
AND the gate exits non-zero
```

```gherkin
SCENARIO: BDD-504 Quarantine is a shrinking ratchet
GIVEN a budget listing a heuristic entry that is no longer flaky and one that still is
WHEN the quarantine is refreshed after a run
THEN the healed entry is pruned during the run-scoped update
AND no new flaky test is ever auto-added and no expiry is ever auto-extended
```

---

## 4. Architecture Decision Records (ADRs)

- **ADR-131-1: Quarantine with a shrinking budget instead of a static ignore list**

  - _Context_: An implicit "known flaky" list lets non-deterministic tests be parked indefinitely, so the green signal slowly loses meaning.
  - _Decision_: Model every known-flaky test as an entry with an owner and an ISO expiry date in `docs/quality/flaky-budget.json`; the list may only shrink, and any expansion beyond an explicit human acknowledgement fails the gate.
  - _Consequence_: Flakiness becomes visible debt that must be fixed or consciously renewed; the trade-off is that an intentional quarantine now requires a manual budget edit.

- **ADR-131-2: Per-test verdicts parsed from the native JUnit reporter**
  - _Context_: Network-free, dependency-free detection is required under Law V, yet classification needs stable per-test identity.
  - _Decision_: Derive verdicts from Node's built-in `--test --test-reporter=junit` output, keying each test by its repo-relative file and name, and strip the nested-runner environment knobs so each repetition is authoritative.
  - _Consequence_: No external test tooling is needed and test identity is deterministic; the trade-off is a dependency on the JUnit XML shape.

---

## 5. Atomic Task DAG

1. [x] **TASK-131-1**: Author this specification (EARS requirements, BDD scenarios, ADR) and link it to the module header.
2. [x] **TASK-131-2**: Implement `EosFlakyTestQuarantine` (`src/core/eosFlakyTestQuarantine.ts`) with precondition-guarded, deterministic classification.
3. [x] **TASK-131-3**: Implement the `scripts/flaky-gate.mjs` wiring (repeated execution, JUnit parsing, quarantine ratchet).
4. [x] **TASK-131-4**: Add `test/eosFlakyTestGate.test.mjs` covering every BDD scenario, including new-flakiness and stale/expired-entry violations.
