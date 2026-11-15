# SPEC-270 — TLC Formal Verification Engine, Mutation Ratchet Expansion, and Consumer Governance

## Metadata

- **SPEC ID**: SPEC-270
- **Change ID**: CHANGE-132
- **Intake ID**: INTAKE-132
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-1 (Formal Verification, Mutation Rigor, and Architecture Governance)
- **Module**: `scripts/run-tlc.mjs`, `scripts/mutation-gate.mjs`, `scripts/verify-module-consumers.mjs`

---

## 1. Overview

`SPEC-270` establishes institutional-grade mathematical verification, test suite mutation resistance, and architecture consumer discipline for Glorian System. It replaces unverified TLA+ assumptions with real Leslie Lamport TLC model checker configurations (`.cfg`) and execution workflows, broadens mutation testing into critical governance subsystems, and halts the proliferation of unconsumed domain specifications through automated consumer graph audits.

---

## 2. Functional Requirements (EARS Syntax)

**FR-270-001** (Event-Driven)
WHEN `scripts/run-tlc.mjs` is executed, THE SYSTEM SHALL detect the presence of `java` and the TLC tools archive (`tla2tools.jar`), locate configured `.tla` specifications and companion `.cfg` model configurations, and run model checking with state-space exploration.

**FR-270-002** (State-Driven)
WHILE executing TLC model checking in an environment where Java or `tla2tools.jar` is absent, THE SYSTEM SHALL NOT fail the build unconditionally; instead, IT SHALL log a structured advisory, verify that `.cfg` model configurations and `.tla` specs are syntactically sound and non-empty, and emit a structured evidence receipt `docs/evidence/TLC_RECEIPT.json` marking status as `DEFERRED_TO_CI_SETUP_JAVA` or `VERIFIED` when run in CI.

**FR-270-003** (Ubiquitous)
THE SYSTEM SHALL provide verified TLC configuration models (`.cfg`) for core protocol specifications: `LmaxDisruptor`, `HermesConsensusMesh`, `DatomicBitemporalLedger`, and `AutonomousChaosDisruptor`, defining formal `SPECIFICATION` / `INIT` / `NEXT`, `INVARIANTS`, and bounded finite `CONSTANTS`.

**FR-270-004** (Event-Driven / Negative Calibration)
WHEN TLC executes against a model containing an intentional invariant violation, THE SYSTEM SHALL verify that TLC halts with an invariant violation error, produces a counterexample state trace, and rejects the erroneous specification (verifying the checker is not a tautological pass).

**FR-270-005** (State-Driven)
WHILE evaluating mutation testing in `scripts/mutation-gate.mjs`, THE SYSTEM SHALL support a configurable target-to-test mapping (`CUSTOM_TARGET_TEST_MAP`) allowing arbitrary modules, scripts, and governance tools to be evaluated against specified test suites, and enforce ratchet thresholds defined in `docs/quality/mutation-budget.json`.

**FR-270-006** (Event-Driven)
WHEN `scripts/verify-module-consumers.mjs` is executed, THE SYSTEM SHALL parse import statements and consumer references across `src/core/`, verify that governance and production subsystems maintain consumer linkages, and generate a dependency coverage report.

---

## 3. BDD Acceptance Scenarios

### BDD-1396 — Formal Model Configuration & TLC Compatibility

```gherkin
SCENARIO: Core TLA+ specifications possess valid TLC .cfg configurations
  GIVEN TLA+ specifications in docs/formal/ for LmaxDisruptor, HermesConsensusMesh, DatomicBitemporalLedger, and AutonomousChaosDisruptor
  WHEN companion .cfg files are inspected by scripts/run-tlc.mjs
  THEN each spec possesses a valid .cfg declaring SPECIFICATION or INIT/NEXT, INVARIANTS, and CONSTANTS
  AND TLA+ modules include all required standard modules (FiniteSets, TLC) for TLC parsing
```

### BDD-1397 — Deterministic TLC Runner & Receipt Generation

```gherkin
SCENARIO: scripts/run-tlc.mjs generates formal verification evidence
  GIVEN scripts/run-tlc.mjs is invoked
  WHEN model verification is evaluated
  THEN docs/evidence/TLC_RECEIPT.json is generated
  AND contains verified protocol targets, timestamp, and verifiable status
```

### BDD-1398 — Negative Calibration of Formal Model Invariant

```gherkin
SCENARIO: TLC runner detects intentional invariant violations
  GIVEN a model with a violated invariant predicate
  WHEN TLC evaluates the violating model
  THEN TLC reports an error state
  AND outputs an counterexample trace demonstrating the failure
```

### BDD-1399 — Mutation Gate Custom Mapping and Governance Expansion

```gherkin
SCENARIO: Mutation gate evaluates governance targets with custom test mappings
  GIVEN scripts/mutation-gate.mjs with CUSTOM_TARGET_TEST_MAP configured
  WHEN mutation evaluation runs on governance targets
  THEN mutations are generated and executed against mapped test suites
  AND scores meet or exceed thresholds in docs/quality/mutation-budget.json
```

### BDD-1400 — Module Consumer Audit and Moratorium Enforcement

```gherkin
SCENARIO: Consumer verification script audits core module linkages
  GIVEN scripts/verify-module-consumers.mjs is executed
  WHEN internal imports and consumer linkages are analyzed
  THEN the script reports total modules, consumed modules, and consumer graph density
  AND exits with code 0 confirming architectural consumer audit execution
```
