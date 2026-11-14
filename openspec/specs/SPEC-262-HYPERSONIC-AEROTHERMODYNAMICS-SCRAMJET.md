# SPEC-262 — Layer-0 Hypersonic Aerothermodynamics & Scramjet Isolator Core

## Metadata

- **SPEC ID**: SPEC-262
- **Change ID**: CHANGE-129
- **Intake ID**: INTAKE-129
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosHypersonicAerothermodynamicsScramjetCore`

---

## 1. Overview

`EosHypersonicAerothermodynamicsScramjetCore` evaluates hypersonic scramjet flight envelopes by solving oblique shock wave angle and Rankine-Hugoniot pressure ratios, Sutton-Graves / Fay-Riddell stagnation convective heat flux, Rayleigh-Fanno isolator thermal choking unstart margins, and air-breathing specific impulse.

---

## 2. Functional Requirements (EARS Syntax)

**FR-262-001** (Event-Driven)
WHEN `evaluateHypersonicAerothermodynamicsScramjet(options)` is invoked, THE SYSTEM SHALL validate non-empty `vehicleId`, `freestreamMach >= 3.0`, positive finite `freestreamDensityKgPerM3`, `freestreamStaticTempK`, `noseLeadingEdgeRadiusMeters`, `maxTpsHeatFluxMwPerM2`, `0 < wedgeDeflectionAngleDeg <= 40`, and `0 < combustorHeatReleaseRatio <= 1.5`.

**FR-262-002** (State-Driven)
WHILE evaluating aerothermal and propulsion flow, THE SYSTEM SHALL compute `obliqueShockAngleDeg`, `normalShockPressureRatio`, `stagnationHeatFluxMwPerM2`, `isolatorUnstartMargin`, and `specificImpulseSec`.

**FR-262-003** (Error Condition)
IF `isolatorUnstartMargin <= 0.08` OR `stagnationHeatFluxMwPerM2 > maxTpsHeatFluxMwPerM2`, THEN THE SYSTEM SHALL emit regime `"ISOLATOR_UNSTART_CRITICAL"`; ELSE IF `isolatorUnstartMargin <= 0.22` OR `stagnationHeatFluxMwPerM2 > 0.8 * maxTpsHeatFluxMwPerM2`, THEN THE SYSTEM SHALL emit `"AEROTHERMAL_FLUX_ELEVATED"`; ELSE `"SUPERSONIC_COMBUSTION_STABLE"`.

**FR-262-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable assessment with `deepFreeze` and a 64-hex `hypersonicAeroDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1356 — Stable Mach 7.8 Supersonic Combustion Envelope

```gherkin
SCENARIO: Mach 7.8 waverider with moderate heat release remains within TPS and unstart limits
  GIVEN default Hypersonic Scramjet options
  WHEN evaluateHypersonicAerothermodynamicsScramjet executes
  THEN regime is "SUPERSONIC_COMBUSTION_STABLE" and isolatorUnstartMargin > 0.22
```

### BDD-1357 — Elevated Aerothermal Heat Flux State

```gherkin
SCENARIO: Higher freestream density pushing heat flux between 80% and 100% of TPS limit warns
  GIVEN freestreamDensityKgPerM3 = 0.085 with nominal Mach 7.8
  WHEN evaluateHypersonicAerothermodynamicsScramjet executes
  THEN regime is "AEROTHERMAL_FLUX_ELEVATED"
```

### BDD-1358 — Rayleigh-Fanno Isolator Unstart Criticality

```gherkin
SCENARIO: Excessive combustor heat release consumes isolator choking margin
  GIVEN combustorHeatReleaseRatio = 0.68
  WHEN evaluateHypersonicAerothermodynamicsScramjet executes
  THEN regime is "ISOLATOR_UNSTART_CRITICAL" and isolatorUnstartMargin <= 0.08
```

### BDD-1359 — Sub-Hypersonic Mach Precondition & Digest Determinism

```gherkin
SCENARIO: Mach < 3.0 throws PRECONDITION_FAILED and valid calls yield identical digest
  GIVEN freestreamMach = 2.0 OR nominal options invoked twice
  WHEN evaluateHypersonicAerothermodynamicsScramjet executes
  THEN Mach < 3.0 throws PRECONDITION_FAILED and valid calls share identical hypersonicAeroDigestSha256
```

### BDD-1360 — End-to-End CLI `aero:scramjet` & MCP `hypersonic_scramjet_aero`

```gherkin
SCENARIO: Dispatch Hypersonic Scramjet Aero via CLI and JSON-RPC MCP tools/call
  GIVEN CLI command aero:scramjet and MCP action "hypersonic_scramjet_aero"
  WHEN invoked via CLI --json and EosMcpServer.handleRequest
  THEN both return regime "SUPERSONIC_COMBUSTION_STABLE" and a 64-hex hypersonicAeroDigestSha256
```
