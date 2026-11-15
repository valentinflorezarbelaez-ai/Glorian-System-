# SPEC-272 — Toolchain Control Plane, Local TLC Execution, and Cold-Start Shield Grace

## Metadata

- **SPEC ID**: SPEC-272
- **Change ID**: CHANGE-134
- **Intake ID**: INTAKE-134
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Core Engine) & Layer-1 (Platform Engineering & SRE)
- **Module**: `src/core/eosToolchainDoctor.ts`, `src/core/eosEventLoopSaturationGovernor.ts`, `api/_shield.js`, `scripts/run-tlc.mjs`

---

## 1. Overview

`SPEC-272` bridges the gap between host tools and Glorian System's sovereign architecture. It implements:

1. `EosToolchainDoctor`: A zero-dependency Layer-0 inspection engine auditing installed platform tools (`docker`, `kubectl`, `kind`, `helm`, `trivy`, `opa`, `terraform`, `k6`, `java`, `rustc`, `cargo`, `go`, `python`) using secure non-shell process spawning.
2. SRE Warmup Grace in `EosEventLoopSaturationGovernor`: Prevents false-positive load shedding during serverless cold starts.
3. Local Leslie Lamport TLC Model Checking: Enables exhaustive state-space verification on developer workstations with Java 21 LTS and SHA-256 verified `tla2tools.jar`.

---

## 2. Functional Requirements (EARS Syntax)

**FR-272-001** (Event-Driven)
WHEN `EosToolchainDoctor.diagnose()` is invoked, THE SYSTEM SHALL execute each registered tool in an isolated child process using direct binary execution without an intermediate shell; IF a tool is absent or errors, THE SYSTEM SHALL record `available: false` and continue evaluating subsequent tools without crashing.

**FR-272-002** (Ubiquitous)
THE SYSTEM SHALL compute a deterministic SHA-256 digest over the collected toolchain report and persist it to `docs/evidence/TOOLCHAIN_RECEIPT.json`.

**FR-272-003** (State-Driven)
WHILE `EosEventLoopSaturationGovernor` is within its warmup threshold (initial sampling cycles), THE SYSTEM SHALL suppress `SHEDDING_ACTIVE` transitions, returning state `WARMUP` or `NORMAL` and allowing requests to be admitted without emitting HTTP 503 during cold starts.

**FR-272-004** (Event-Driven)
WHEN sustained event loop lag exceeds critical thresholds after the warmup period has elapsed, THE SYSTEM SHALL transition to `SHEDDING_ACTIVE` and shed incoming requests with HTTP 503 and header `Retry-After: 1`.

**FR-272-005** (Ubiquitous)
THE SYSTEM SHALL ensure that `tools/tla2tools.jar` matches the release digest `sha256:7e53aa636dac8a3cb0533f343115c0548e03fc0ce5edc7739becf58d3d0fb84f` prior to execution.

**FR-272-006** (State-Driven)
WHILE executing `scripts/run-tlc.mjs` with Java 21 and the verified `tla2tools.jar` present, THE SYSTEM SHALL execute TLC exhaustive model exploration in mode `LIVE_LOCAL_TLC`, validating invariants for all configured specifications and generating a receipt in `docs/evidence/TLC_RECEIPT.json`.

---

## 3. BDD Acceptance Scenarios

### BDD-1407 — Toolchain Doctor Audit Execution

```gherkin
SCENARIO: EosToolchainDoctor audits host binaries safely
  GIVEN EosToolchainDoctor is invoked
  WHEN diagnose() executes against registered tools
  THEN it returns a structured report containing status and version for each tool
  AND writes docs/evidence/TOOLCHAIN_RECEIPT.json with a valid SHA-256 receipt
```

### BDD-1408 — Toolchain Doctor Fail-Soft Missing Tool Handling

```gherkin
SCENARIO: Toolchain Doctor handles missing or failing binaries gracefully
  GIVEN an uninstalled or mock failing binary name
  WHEN evaluateTool() executes
  THEN the result marks available: false with an error message
  AND the overall diagnosis completes without unhandled exceptions
```

### BDD-1409 — Saturation Governor Warmup Grace

```gherkin
SCENARIO: Initial bootstrap lag does not trigger load shedding
  GIVEN an EosEventLoopSaturationGovernor configured with a warmup cycle count of 3
  WHEN simulated bootstrap lag of 100ms is injected during cycle 1
  THEN shouldShedLoad("NORMAL") returns false
  AND the governor remains in non-shedding state
```

### BDD-1410 — Sustained Lag Shedding Post-Warmup

```gherkin
SCENARIO: Sustained post-warmup lag triggers shedding
  GIVEN an EosEventLoopSaturationGovernor past its warmup threshold
  WHEN simulated lag of 60ms persists across sampling cycles
  THEN shouldShedLoad("NORMAL") returns true
  AND the governor transitions to SHEDDING_ACTIVE
```

### BDD-1411 — TLC Jar Hash Verification

```gherkin
SCENARIO: tla2tools.jar is verified against canonical release SHA-256
  GIVEN the jar file at tools/tla2tools.jar
  WHEN its SHA-256 hash is computed
  THEN it matches 7e53aa636dac8a3cb0533f343115c0548e03fc0ce5edc7739becf58d3d0fb84f
```

### BDD-1412 — Local TLC Live Invariant Verification

```gherkin
SCENARIO: Local TLC model checking executes live across configured protocols
  GIVEN Java 21 runtime and verified tools/tla2tools.jar
  WHEN scripts/run-tlc.mjs executes
  THEN the receipt records executionMode LIVE_LOCAL_TLC
  AND all configured formal models pass invariant checks
```
