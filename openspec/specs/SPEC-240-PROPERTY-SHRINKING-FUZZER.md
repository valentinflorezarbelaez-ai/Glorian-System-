# SPEC-240 — Layer-0 Property-Based Testing & Counterexample Shrinking Engine

## Metadata

- **SPEC ID**: SPEC-240
- **Change ID**: CHANGE-121
- **Intake ID**: INTAKE-121
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosPropertyBasedShrinkingFuzzerCore`

---

## 1. Overview

`EosPropertyBasedShrinkingFuzzerCore` brings QuickCheck/Hypothesis-style property-based testing and deterministic counterexample shrinking (`xorshift32` PRNG + binary numeric shrinking + halving/char-trimming string shrinking) to Layer-0 with zero third-party dependencies.

---

## 2. Functional Requirements (EARS Syntax)

**FR-240-001** (Event-Driven)
WHEN `checkNumericProperty(options)` evaluates `predicate` across bounded seeded integers and detects a failing value, THE SYSTEM SHALL run binary shrinking toward `0` (bounded by `min`) up to `maxShrinkSteps` and return `passed: false` with `minimalCounterexample` satisfying `Math.abs(minimalCounterexample) <= Math.abs(initialFailingInput)` and still failing `predicate`.

**FR-240-002** (Event-Driven)
WHEN `checkStringProperty(options)` evaluates `predicate` across seeded strings and detects a failing string, THE SYSTEM SHALL shrink by halving and single-character deletion up to `maxShrinkSteps` to emit the shortest `minimalCounterexample` still failing `predicate`.

**FR-240-003** (State-Driven)
WHILE all generated runs satisfy `predicate`, THE SYSTEM SHALL return `passed: true`, `shrinkStepsTaken: 0`, undefined counterexamples, and a deterministic 64-hex `resultDigestSha256`.

**FR-240-004** (Event-Driven)
WHEN `runBuiltInSuite(seed)` executes, THE SYSTEM SHALL verify built-in mathematical, cryptographic normalization, and parser invariants and emit `PropertySuiteReport` with `allPassed: true`.

---

## 3. BDD Acceptance Scenarios

### BDD-1221 — Numeric Counterexample Discovery & Binary Shrinking

```gherkin
SCENARIO: Shrink failing numeric input down to exact boundary integer
  GIVEN numeric predicate `(n) => n < 42` over range [0, 10000]
  WHEN checkNumericProperty executes
  THEN passed MUST be false
  AND minimalCounterexample MUST equal 42
```

### BDD-1222 — String Counterexample Shrinking to Minimal Failing Substring

```gherkin
SCENARIO: Shrink long failing string containing forbidden token to minimal length
  GIVEN string predicate `(s) => !s.includes("A")` over maxLength 32
  WHEN checkStringProperty runs on a seeded string containing "A"
  THEN passed MUST be false
  AND minimalCounterexample MUST shrink strictly to "A"
```

### BDD-1223 — Passing Property Invariant with Deterministic Digest

```gherkin
SCENARIO: Verify passing invariant across 100 deterministic runs
  GIVEN numeric predicate `(n) => n * 0 === 0` with seed 2026
  WHEN checkNumericProperty executes twice
  THEN passed MUST be true, shrinkStepsTaken MUST be 0, and both digests MUST match
```

### BDD-1224 — Built-In Invariant Suite Execution

```gherkin
SCENARIO: Execute runBuiltInSuite with deterministic seed
  GIVEN seed = 1337
  WHEN runBuiltInSuite(1337) runs
  THEN allPassed MUST be true and totalProperties MUST be 3
```

### BDD-1225 — Integration with `glorian ship` CLI & MCP

```gherkin
SCENARIO: Execute end-to-end `ship --json` and `jarvis_ship_readiness` MCP action
  GIVEN local workspace invocation of `node bin/eos.mjs ship --json` and `dispatchPhase7FrontierActionExt2("jarvis_ship_readiness", ...)`
  WHEN executed cleanly
  THEN ship MUST output shipReadinessVerdict ("SHIP_APPROVED" or "SHIP_BLOCKED"), liveDiff, repoMap, propertySuite, canaryPlan, and staffJudge reports
```
