# SPEC-257 — Layer-0 Unified Memory Fabric DMA Arbitration, DVFS & Thermal QoS Core

## Metadata

- **SPEC ID**: SPEC-257
- **Change ID**: CHANGE-128
- **Intake ID**: INTAKE-128
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosUnifiedMemoryDmaDvfsQosCore`

---

## 1. Overview

`EosUnifiedMemoryDmaDvfsQosCore` arbitrates priority-ordered unified-memory SoC DMA streams against fabric bandwidth ceilings, models dynamic CMOS switching power ($C_{\mathrm{eff}} V^2 f$) plus static leakage, computes junction temperature, and determines safe DVFS P-states.

---

## 2. Functional Requirements (EARS Syntax)

**FR-257-001** (Event-Driven)
WHEN `evaluateUnifiedMemoryDmaDvfsQos(options)` is invoked, THE SYSTEM SHALL validate positive `totalUnifiedBandwidthGBps`, valid electrical bounds `0.4 <= voltageVolts <= 1.6`, `0.2 <= frequencyGhz <= 6.5`, positive capacitance/thermal resistance, non-empty `streams`, and non-negative DMA stream bandwidth requests.

**FR-257-002** (State-Driven)
WHILE evaluating fabric and thermal telemetry, THE SYSTEM SHALL grant stream bandwidth in ascending priority order up to `totalUnifiedBandwidthGBps`, compute `dynamicPowerWatts = effectiveCapacitanceNf * voltageVolts * voltageVolts * frequencyGhz`, `totalPackagePowerWatts = dynamicPowerWatts + staticLeakageWatts`, and `junctionTempC = ambientTempC + totalPackagePowerWatts * thermalResistanceCPerW`.

**FR-257-003** (Error Condition)
IF `junctionTempC > maxJunctionTempC + 10` OR `utilizationRatio > 1.0`, THEN THE SYSTEM SHALL emit `"THERMAL_OR_BANDWIDTH_SATURATED"`; ELSE IF `junctionTempC > maxJunctionTempC` OR `utilizationRatio > 0.95`, THEN THE SYSTEM SHALL emit `"DVFS_PSTATE_THROTTLED"` with `"P1_EFFICIENCY_CLAMP"`; ELSE `"QOS_AND_THERMAL_NOMINAL"`.

**FR-257-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable report with `deepFreeze` and a 64-hex `dvfsQosDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1331 — Nominal Unified Memory QoS & P0 Turbo

```gherkin
SCENARIO: Within-budget DMA streams and cool silicon junction sustain P0_TURBO
  GIVEN 800 GB/s fabric, 720 GB/s total requests, 0.85 V, and 3.2 GHz at 32 C ambient
  WHEN evaluateUnifiedMemoryDmaDvfsQos executes
  THEN verdict is "QOS_AND_THERMAL_NOMINAL", pState is "P0_TURBO", and all streams receive requestedGBps
```

### BDD-1332 — Moderate Over-Temperature DVFS Clamp

```gherkin
SCENARIO: Junction temperature exceeding maxJunctionTempC triggers P1_EFFICIENCY_CLAMP
  GIVEN voltageVolts = 1.35 and frequencyGhz = 4.8 raising junctionTempC between 95 C and 105 C
  WHEN evaluateUnifiedMemoryDmaDvfsQos executes
  THEN verdict is "DVFS_PSTATE_THROTTLED" and pState is "P1_EFFICIENCY_CLAMP"
```

### BDD-1333 — Fabric Bandwidth Saturation & Priority Preservation

```gherkin
SCENARIO: Oversubscribed DMA fabric throttles lower-priority streams while protecting RT priority 0
  GIVEN streams totaling 950 GB/s against 800 GB/s fabric capacity
  WHEN evaluateUnifiedMemoryDmaDvfsQos executes
  THEN verdict is "THERMAL_OR_BANDWIDTH_SATURATED" and priority 0 stream receives 100% requested bandwidth
```

### BDD-1334 — Electrical Bounds Precondition & Digest Determinism

```gherkin
SCENARIO: Invalid voltage outside [0.4, 1.6] V throws Error and nominal calls yield identical digests
  GIVEN voltageVolts = 2.5 OR valid nominal options
  WHEN evaluateUnifiedMemoryDmaDvfsQos executes
  THEN voltage 2.5 throws Error and nominal calls match 64-hex dvfsQosDigestSha256
```

### BDD-1335 — End-to-End CLI `dvfs:qos` & JSON-RPC MCP `unified_memory_dvfs_qos`

```gherkin
SCENARIO: Dispatch Unified Memory DVFS & QoS via CLI and EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler dvfs:qos and MCP action "unified_memory_dvfs_qos" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both succeed with verdict "QOS_AND_THERMAL_NOMINAL" and a 64-hex dvfsQosDigestSha256
```
