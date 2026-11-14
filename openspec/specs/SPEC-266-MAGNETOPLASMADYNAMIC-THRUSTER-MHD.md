# SPEC-266 — Layer-0 Magnetoplasmadynamic (MPD) Thruster & Lorentz MHD Core

## Metadata

- **SPEC ID**: SPEC-266
- **Change ID**: CHANGE-130
- **Intake ID**: INTAKE-130
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosMagnetoplasmadynamicThrusterMhdCore`

---

## 1. Overview

`EosMagnetoplasmadynamicThrusterMhdCore` models high-power applied-field magnetoplasmadynamic (AF-MPD) electromagnetic plasma thrusters, solving the Maecker self-field azimuthal pinch thrust equation and applied-field Hall/swirl Lorentz acceleration force, specific impulse, thruster efficiency, and the Alfven critical ionization / Choueiri onset current instability ceiling ($J^2 / \dot{m}$).

---

## 2. Functional Requirements (EARS Syntax)

**FR-266-001** (Event-Driven)
WHEN `evaluateMagnetoplasmadynamicThrusterMhd(options)` is invoked, THE SYSTEM SHALL validate non-empty `thrusterId`, positive finite `dischargeCurrentAmps`, `massFlowRateKgPerSec`, `anodeRadiusMeters`, `cathodeRadiusMeters`, `inputPowerKw`, `propellantAtomicMassAmu`, non-negative finite `appliedMagneticFieldTesla`, and precondition `anodeRadiusMeters > cathodeRadiusMeters`.

**FR-266-002** (State-Driven)
WHILE modeling Lorentz electromagnetic plasma acceleration, THE SYSTEM SHALL compute `selfFieldThrustNewtons`, `appliedFieldThrustNewtons`, `totalThrustNewtons`, `exhaustVelocityMPerSec`, `specificImpulseSec`, `onsetCriticalCurrentAmps`, `onsetStabilityRatio`, and `thrustEfficiency`.

**FR-266-003** (Error Condition)
IF `onsetStabilityRatio > 1.0`, THEN THE SYSTEM SHALL emit regime `"ONSET_INSTABILITY_CRITICAL"`; ELSE IF `onsetStabilityRatio > 0.85`, THEN THE SYSTEM SHALL emit `"ANODE_FALL_EROSION_WARNING"`; ELSE `"LORENTZ_PLASMA_ACCELERATION_LOCKED"`.

**FR-266-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable assessment with `deepFreeze` and a 64-hex `mpdThrusterDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1376 — Stable High-Power Applied-Field Lithium MPD Acceleration

```gherkin
SCENARIO: 450 kW Lithium AF-MPD thruster at 4200 A operates below onset stability ceiling
  GIVEN default MPD Thruster MHD options
  WHEN evaluateMagnetoplasmadynamicThrusterMhd executes
  THEN regime is "LORENTZ_PLASMA_ACCELERATION_LOCKED" and onsetStabilityRatio <= 0.85
```

### BDD-1377 — Anode-Fall Erosion Warning Band

```gherkin
SCENARIO: Pushing discharge current to 5000 A enters 85%-100% onset warning band
  GIVEN dischargeCurrentAmps = 5000.0 with nominal lithium propellant feed
  WHEN evaluateMagnetoplasmadynamicThrusterMhd executes
  THEN regime is "ANODE_FALL_EROSION_WARNING" and 0.85 < onsetStabilityRatio <= 1.0
```

### BDD-1378 — Alfven Onset Plasma Instability Criticality

```gherkin
SCENARIO: Starved propellant mass flow or excessive current exceeds critical onset current
  GIVEN dischargeCurrentAmps = 6200.0 driving onsetStabilityRatio > 1.0
  WHEN evaluateMagnetoplasmadynamicThrusterMhd executes
  THEN regime is "ONSET_INSTABILITY_CRITICAL" and onsetStabilityRatio > 1.0
```

### BDD-1379 — Electrode Geometry Precondition & Digest Determinism

```gherkin
SCENARIO: Cathode radius >= anode radius throws PRECONDITION_FAILED and valid calls repeat digest
  GIVEN cathodeRadiusMeters = 0.06 (>= anodeRadiusMeters = 0.055) OR default options invoked twice
  WHEN evaluateMagnetoplasmadynamicThrusterMhd executes
  THEN invalid geometry throws PRECONDITION_FAILED and valid calls share identical mpdThrusterDigestSha256
```

### BDD-1380 — End-to-End CLI `mpd:thruster` & MCP `mpd_magnetoplasmadynamic_thruster`

```gherkin
SCENARIO: Dispatch MPD Thruster MHD via CLI and JSON-RPC MCP tools/call
  GIVEN CLI command mpd:thruster and MCP action "mpd_magnetoplasmadynamic_thruster"
  WHEN invoked via CLI --json and EosMcpServer.handleRequest
  THEN both return regime "LORENTZ_PLASMA_ACCELERATION_LOCKED" and a 64-hex mpdThrusterDigestSha256
```
