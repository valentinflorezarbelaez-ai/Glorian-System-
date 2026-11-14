# SPEC-252 — Layer-0 Six-Sigma Statistical Process Control (SPC) & Yield Engine

## Metadata

- **SPEC ID**: SPEC-252
- **Change ID**: CHANGE-126
- **Intake ID**: INTAKE-126
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosStatisticalProcessYieldControlCore`

---

## 1. Overview

`EosStatisticalProcessYieldControlCore` applies semiconductor foundry statistical process control (`Shewhart`, `Cp`/`Cpk`, two-sided `CUSUM`, `EWMA`, and `Poisson`/`Murphy` yield laws) to monitor pipeline metrics, build latencies, and SLO drift with deterministic pass/fail control verdicts.

---

## 2. Functional Requirements (EARS Syntax)

**FR-252-001** (Event-Driven)
WHEN `auditProcessCapabilityAndYield(options)` executes, THE SYSTEM SHALL compute sample `mean`, `stdDev`, Shewhart control limits (`ucl = mean + 3 * stdDev`, `lcl = mean - 3 * stdDev`), and capability indices `cp` and `cpk` against `[lsl, usl]`.

**FR-252-002** (State-Driven)
WHILE processing ordered observations, THE SYSTEM SHALL evaluate two-sided tabular CUSUM (`k = 0.5 * stdDev`, `h = 4 * stdDev`) and EWMA (`lambda = 0.2`) statistics, counting out-of-control excursions and computing `poissonYieldPercent` and `murphyYieldPercent`.

**FR-252-003** (Error Condition & Ubiquitous)
IF `samples.length < 2` or `usl <= lsl`, THEN THE SYSTEM SHALL fail closed by throwing an `Error`. OTHERWISE THE SYSTEM SHALL emit `"SIX_SIGMA_LOCKED"`, `"SPC_DRIFT_WARNING"`, or `"PROCESS_EXCURSION_HALT"` along with a frozen report and 64-hex `spcDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1281 — Centered Nominal Batch Achieves SIX_SIGMA_LOCKED & Cpk >= 1.33

```gherkin
SCENARIO: Audit nominal centered series against [94, 106] specification limits
  GIVEN default tightly controlled sample series centered near 100
  WHEN auditProcessCapabilityAndYield executes
  THEN verdict is "SIX_SIGMA_LOCKED", cpk >= 1.33, outOfControlPointsCount is 0, and cusumDriftDetected is false
```

### BDD-1282 — CUSUM Shift Detection On Sustained Step Drift

```gherkin
SCENARIO: Detect subtle sustained upward mean shift via two-sided CUSUM
  GIVEN samples beginning centered near 100 and shifting monotonically toward 104.5
  WHEN auditProcessCapabilityAndYield evaluates CUSUM statistics
  THEN cusumDriftDetected is true and maxCusumHigh exceeds threshold H
```

### BDD-1283 — Excursion Halt On Spec Limit Violation

```gherkin
SCENARIO: Trigger PROCESS_EXCURSION_HALT when samples exceed USL or LSL
  GIVEN samples containing an excursion point at 112 with usl = 106
  WHEN auditProcessCapabilityAndYield executes
  THEN outOfControlPointsCount >= 1 and verdict is "PROCESS_EXCURSION_HALT"
```

### BDD-1284 — Poisson & Murphy Yield Monotonicity And Fail-Closed Preconditions

```gherkin
SCENARIO: Enforce Murphy >= Poisson relation and reject invalid spec intervals
  GIVEN criticalAreaCm2 > 0 and defectDensityPerCm2 > 0
  WHEN auditProcessCapabilityAndYield executes vs invalid inputs (usl <= lsl or <2 samples)
  THEN murphyYieldPercent >= poissonYieldPercent for positive A*D0 and invalid bounds throw explicit Errors
```

### BDD-1285 — CLI spc:audit & MCP spc_yield_audit Dispatch

```gherkin
SCENARIO: Dispatch SPC Yield Audit via CLI and MCP Server
  GIVEN wired handlers for spc:audit and eos_enterprise_workspace action "spc_yield_audit"
  WHEN invoked in JSON mode
  THEN both return SIX_SIGMA_LOCKED and valid 64-hex spcDigestSha256
```
