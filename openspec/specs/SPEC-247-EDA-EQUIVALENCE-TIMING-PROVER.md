# SPEC-247 — Layer-0 EDA Equivalence, Static Timing & seL4 Non-Interference Prover

## Metadata

- **SPEC ID**: SPEC-247
- **Change ID**: CHANGE-124
- **Intake ID**: INTAKE-124
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosEdaEquivalenceTimingProverCore`

---

## 1. Overview

`EosEdaEquivalenceTimingProverCore` unifies silicon-grade **Logical Equivalence Checking (LEC)**, **Static Timing Analysis (STA)** over execution DAGs, and **seL4-style Information-Flow Non-Interference** verification inside a pure Layer-0 TypeScript engine.

---

## 2. Functional Requirements (EARS Syntax)

**FR-247-001** (Event-Driven)
WHEN `proveEquivalenceTimingAndIsolation(options)` executes, THE SYSTEM SHALL evaluate `referenceFn(x) === candidateFn(x)` over every element of `inputDomain`, reporting `lecEquivalent = true` when all match or `lecEquivalent = false` with `firstCounterexample` on the first divergence.

**FR-247-002** (Event-Driven)
WHEN `timingDag` is evaluated against `clockBudgetMicros`, THE SYSTEM SHALL compute topological longest-path arrival times, `criticalPathDelayMicros`, `criticalPathNodes`, `slackMicros = clockBudgetMicros - criticalPathDelayMicros`, and set `timingMet = slackMicros >= 0`.

**FR-247-003** (Error / Unwanted Condition)
IF `timingDag` contains a cyclic dependency, THEN THE SYSTEM SHALL fail closed by throwing `Cyclic dependency detected in timing DAG`. IF any flow connects `HIGH_SECRET` or `KERNEL` source domains to `LOW_PUBLIC` without `declassified = true`, THEN THE SYSTEM SHALL record it in `illegalFlows` and set `nonInterferenceVerified = false`.

**FR-247-004** (State-Driven & Ubiquitous)
WHILE `lecEquivalent && timingMet && nonInterferenceVerified`, THE SYSTEM SHALL emit `verdict = "SILICON_FORMAL_VERIFIED"`; otherwise `"FORMAL_VIOLATION_BLOCKED"`. THE SYSTEM SHALL deep-freeze the report and compute a deterministic 64-hex `proverDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1256 — Verifies Matching Reference/Candidate Functions, Positive Slack & Clean Isolation

```gherkin
SCENARIO: Prove default bit-shift equivalence, positive STA slack, and safe declassified flow
  GIVEN default reference/candidate functions, 4-stage DAG (400us <= 500us), and safe flows
  WHEN EosEdaEquivalenceTimingProverCore.proveEquivalenceTimingAndIsolation executes
  THEN lecEquivalent is true, slackMicros is 100, nonInterferenceVerified is true, and verdict is "SILICON_FORMAL_VERIFIED"
```

### BDD-1257 — Detects Logical Equivalence Divergence With Exact Counterexample

```gherkin
SCENARIO: Surface exact failing input when candidate logic diverges from reference specification
  GIVEN candidateFn returning wrong value when x >= 10
  WHEN proveEquivalenceTimingAndIsolation executes
  THEN lecEquivalent is false, firstCounterexample.input is 10, and verdict is "FORMAL_VIOLATION_BLOCKED"
```

### BDD-1258 — Flags Negative Timing Slack When Critical Path Exceeds Clock Budget

```gherkin
SCENARIO: Fail closed when DAG critical path exceeds clockBudgetMicros
  GIVEN a timingDag whose longest path is 650us against clockBudgetMicros = 500
  WHEN proveEquivalenceTimingAndIsolation executes
  THEN criticalPathDelayMicros is 650, slackMicros is -150, timingMet is false, and verdict is "FORMAL_VIOLATION_BLOCKED"
```

### BDD-1259 — Rejects Cyclic Timing DAG Topologies

```gherkin
SCENARIO: Throw deterministic error when timingDag contains a cycle
  GIVEN node A depends on B and B depends on A
  WHEN proveEquivalenceTimingAndIsolation executes
  THEN the call throws "Cyclic dependency detected in timing DAG"
```

### BDD-1260 — Detects Unclassified HIGH_SECRET to LOW_PUBLIC Information Leak

```gherkin
SCENARIO: Block unapproved downward security-domain flow (seL4 non-interference violation)
  GIVEN an edge from sourceDomain "HIGH_SECRET" to sinkDomain "LOW_PUBLIC" without declassified = true
  WHEN proveEquivalenceTimingAndIsolation executes
  THEN nonInterferenceVerified is false, illegalFlows is non-empty, and verdict is "FORMAL_VIOLATION_BLOCKED"
```
