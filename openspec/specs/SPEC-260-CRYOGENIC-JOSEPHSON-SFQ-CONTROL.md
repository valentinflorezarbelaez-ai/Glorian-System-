# SPEC-260 — Layer-0 Cryogenic Josephson Junction & SFQ Control Core

## Metadata

- **SPEC ID**: SPEC-260
- **Change ID**: CHANGE-129
- **Intake ID**: INTAKE-129
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosCryogenicJosephsonSfqControlCore`

---

## 1. Overview

`EosCryogenicJosephsonSfqControlCore` models superconducting Single-Flux-Quantum (SFQ) Josephson junction logic operating at millikelvin dilution refrigerator stages, verifying RCSJ overdamped stability ($\beta_c \le 1$), $I_c R_n$ characteristic frequency, dynamic SFQ switching dissipation against stage cooling capacity, and quasiparticle thermal noise ratio.

---

## 2. Functional Requirements (EARS Syntax)

**FR-260-001** (Event-Driven)
WHEN `evaluateCryogenicJosephsonSfqControl(options)` is invoked, THE SYSTEM SHALL validate non-empty `cryoArrayId`, positive finite `mixingChamberTempMk`, `criticalCurrentMicroAmps`, `shuntResistanceOhms`, `junctionCapacitanceFf`, `sfqClockGhz`, `stageCoolingCapacityMicroWatts`, and integer `activeJunctionCount >= 1`.

**FR-260-002** (State-Driven)
WHILE evaluating superconducting SFQ operating margins, THE SYSTEM SHALL compute `characteristicVoltageMicroVolts`, `characteristicFreqGhz`, `stewartMcCumberBetaC`, `dynamicSfqPowerMicroWatts`, `thermalLoadRatio`, and `quasiparticleThermalNoiseGamma`.

**FR-260-003** (Error Condition)
IF `stewartMcCumberBetaC > 1.0` OR `thermalLoadRatio > 1.0` OR `mixingChamberTempMk > 100.0`, THEN THE SYSTEM SHALL emit regime `"QUASIPARTICLE_HYSTERESIS_RISK"`; ELSE IF `stewartMcCumberBetaC > 0.85` OR `thermalLoadRatio > 0.75`, THEN THE SYSTEM SHALL emit `"THERMAL_HEADROOM_WARNING"`; ELSE `"OVERDAMPED_SFQ_LOCKED"`.

**FR-260-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable assessment with `deepFreeze` and a 64-hex `cryoSfqDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1346 — Nominal 15 mK Overdamped SFQ Array Lock

```gherkin
SCENARIO: 65536 shunted Josephson junctions at 15 mK remain overdamped within cooling budget
  GIVEN default Cryogenic Josephson SFQ options
  WHEN evaluateCryogenicJosephsonSfqControl executes
  THEN regime is "OVERDAMPED_SFQ_LOCKED", stewartMcCumberBetaC < 0.85, and thermalLoadRatio < 0.75
```

### BDD-1347 — Thermal Headroom Warning State

```gherkin
SCENARIO: Elevated clock frequency utilizing >75% of cooling power triggers warning
  GIVEN sfqClockGhz = 120.0 yielding thermalLoadRatio between 0.75 and 1.0
  WHEN evaluateCryogenicJosephsonSfqControl executes
  THEN regime is "THERMAL_HEADROOM_WARNING"
```

### BDD-1348 — Hysteretic Beta_c or Thermal Overload Risk

```gherkin
SCENARIO: Underdamped shunt resistance pushing beta_c > 1 triggers hysteresis risk
  GIVEN shuntResistanceOhms = 5.0 producing stewartMcCumberBetaC > 1.0
  WHEN evaluateCryogenicJosephsonSfqControl executes
  THEN regime is "QUASIPARTICLE_HYSTERESIS_RISK" and stewartMcCumberBetaC > 1.0
```

### BDD-1349 — Positive Cooling Capacity Precondition & Digest Determinism

```gherkin
SCENARIO: Non-positive cooling capacity throws PRECONDITION_FAILED and valid calls repeat digest
  GIVEN stageCoolingCapacityMicroWatts = 0 OR default options invoked twice
  WHEN evaluateCryogenicJosephsonSfqControl executes
  THEN zero cooling capacity throws PRECONDITION_FAILED and nominal calls share cryoSfqDigestSha256
```

### BDD-1350 — End-to-End CLI `cryo:josephson` & MCP `cryogenic_josephson_sfq`

```gherkin
SCENARIO: Dispatch Cryo Josephson SFQ via CLI and JSON-RPC MCP tools/call
  GIVEN CLI command cryo:josephson and MCP action "cryogenic_josephson_sfq"
  WHEN invoked via CLI --json and EosMcpServer.handleRequest
  THEN both return regime "OVERDAMPED_SFQ_LOCKED" and a 64-hex cryoSfqDigestSha256
```
