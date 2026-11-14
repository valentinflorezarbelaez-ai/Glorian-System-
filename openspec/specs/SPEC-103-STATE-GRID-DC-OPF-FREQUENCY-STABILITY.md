# SPEC-103 — Layer-0 DC Optimal Power Flow & Hyperscale Frequency Stability Core

## Metadata

- **SPEC ID**: SPEC-103
- **Change ID**: CHANGE-127
- **Intake ID**: INTAKE-127
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosPowerGridOptimalPowerFlowCore`

---

## 1. Overview

`EosPowerGridOptimalPowerFlowCore` models UHV transmission networks serving hyperscale AI compute campuses: it dispatches generators in merit order (`marginalCostPerMwh`), validates corridor DC thermal flows against `thermalLimitMw`, computes primary frequency droop $\Delta f = -\Delta P_{\text{step}} / \sum(1/R_i)$ and inertial Rate of Change of Frequency ($\text{RoCoF}$) during sudden AI GPU training load ramps, and checks steady-state voltage stability margins.

---

## 2. Functional Requirements (EARS Syntax)

**FR-103-001** (Event-Driven)
WHEN `solveDcOpfAndFrequencyStability(options)` runs, THE SYSTEM SHALL validate positive total demand, finite nominal frequency (`50` or `60` Hz), and strictly positive generator capacity ceilings.

**FR-103-002** (State-Driven)
WHILE allocating generation against `totalDemandMw` + `datacenterStepLoadMw`, THE SYSTEM SHALL sort online units by lowest `marginalCostPerMwh` and enforce unit `[minOutputMw, maxOutputMw]` bounds, recording `totalDispatchCostPerHour` and unserved demand deficit if generation capacity is exhausted.

**FR-103-003** (Ubiquitous)
THE SYSTEM SHALL evaluate each corridor's flow loading ratio (`Math.abs(flowMw) / thermalLimitMw`), `maxLineLoadingRatio`, primary droop frequency nadir (`nadirFrequencyHz`), `rocofHzPerSec`, and minimum bus voltage per-unit (`minBusVoltagePu`).

**FR-103-004** (Error Condition)
IF generation capacity cannot serve demand OR `maxLineLoadingRatio > 1.2` OR `nadirFrequencyHz` breaches emergency UFLS limits (`< nominal - 1.2 Hz`), THEN THE SYSTEM SHALL emit `"BLACKOUT_LOAD_SHED_REQUIRED"`; ELSE IF `maxLineLoadingRatio >= 0.9` OR `Math.abs(deltaFreqHz) > 0.3` OR `rocofHzPerSec > 0.5`, THEN emit `"THERMAL_OR_FREQUENCY_STRESS"`; ELSE `"GRID_OPF_STABLE"`.

**FR-103-005** (Ubiquitous)
THE SYSTEM SHALL freeze the output contract via `deepFreeze` and attach a 64-hex `gridOpfDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1301 — Economic Merit-Order Dispatch & Nominal Frequency Stability

```gherkin
SCENARIO: Solve nominal UHV grid DC-OPF with zero thermal overloads and stable droop frequency
  GIVEN sufficient nuclear/hydro/gas dispatchable capacity serving 4200 MW plus 120 MW AI step load
  WHEN solveDcOpfAndFrequencyStability executes
  THEN verdict is "GRID_OPF_STABLE", totalDispatchedMw equals totalDemandMw + datacenterStepLoadMw, and maxLineLoadingRatio < 0.9
```

### BDD-1302 — AI Cluster Step Ramp Triggers Frequency/Thermal Stress Warning

```gherkin
SCENARIO: Large sudden datacenter load step causes primary droop stress without blackout
  GIVEN sudden 480 MW GPU cluster ramp against limited spinning droop reserve
  WHEN solveDcOpfAndFrequencyStability executes
  THEN verdict is "THERMAL_OR_FREQUENCY_STRESS" and deltaFreqHz reflects negative droop excursion
```

### BDD-1303 — Generation Deficit & Corridor Overload Requires Load Shedding

```gherkin
SCENARIO: Total demand exceeding generation capacity forces BLACKOUT_LOAD_SHED_REQUIRED
  GIVEN totalDemandMw exceeding sum of generator maxOutputMw
  WHEN solveDcOpfAndFrequencyStability executes
  THEN verdict is "BLACKOUT_LOAD_SHED_REQUIRED" and unservedDemandMw > 0
```

### BDD-1304 — Invalid Demand Guard & Deterministic Receipt

```gherkin
SCENARIO: Reject non-positive demand inputs and guarantee deterministic SHA-256 digest
  GIVEN totalDemandMw <= 0 OR repeated nominal OPF runs
  WHEN solveDcOpfAndFrequencyStability executes
  THEN invalid demand throws an Error, while nominal runs produce identical gridOpfDigestSha256
```

### BDD-1305 — End-to-End CLI `grid:opf` & JSON-RPC MCP `power_grid_opf`

```gherkin
SCENARIO: Dispatch Grid DC-OPF via CLI and full EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler grid:opf and MCP action "power_grid_opf" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both return verdict "GRID_OPF_STABLE" and a 64-hex gridOpfDigestSha256
```
