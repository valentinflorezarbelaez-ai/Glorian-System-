# SPEC-259 — Layer-0 Deep Space Optical Navigation & XNAV Ephemeris Core

## Metadata

- **SPEC ID**: SPEC-259
- **Change ID**: CHANGE-129
- **Intake ID**: INTAKE-129
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosDeepSpaceOpticalNavEphemerisCore`

---

## 1. Overview

`EosDeepSpaceOpticalNavEphemerisCore` computes autonomous deep-space spacecraft ephemeris solutions by fusing millisecond-pulsar XNAV timing triangulation with Delta-DOR angular astrometry, while accounting for relativistic solar Shapiro gravitational time delay and relativistic stellar aberration.

---

## 2. Functional Requirements (EARS Syntax)

**FR-259-001** (Event-Driven)
WHEN `evaluateDeepSpaceOpticalNavEphemeris(options)` is invoked, THE SYSTEM SHALL validate non-empty `missionId`, positive finite `heliocentricDistanceAu`, `spacecraftVelocityKmPerSec`, `pulsarTimingResidualNs`, `deltaDorResidualPrad`, `maxPositionUncertaintyKm`, `0 < sunEarthProbeAngleDeg <= 180`, and integer `pulsarCount >= 3`.

**FR-259-002** (State-Driven)
WHILE computing navigation observables, THE SYSTEM SHALL calculate `oneWayLightTimeSec`, relativistic `shapiroDelayMicroSec`, `stellarAberrationMicroRad`, `xnavPositionUncertaintyKm`, `deltaDorPositionUncertaintyKm`, and combined 3D RSS `combinedPositionUncertaintyKm`.

**FR-259-003** (Error Condition)
IF `combinedPositionUncertaintyKm > maxPositionUncertaintyKm`, THEN THE SYSTEM SHALL emit regime `"EPHEMERIS_DRIFT_CRITICAL"`; ELSE IF `sunEarthProbeAngleDeg < 5.0` OR `combinedPositionUncertaintyKm > 0.8 * maxPositionUncertaintyKm`, THEN THE SYSTEM SHALL emit `"SOLAR_CONJUNCTION_CAUTION"`; ELSE `"NOMINAL_DEEP_SPACE_LOCK"`.

**FR-259-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable assessment with `deepFreeze` and a 64-hex `deepSpaceNavDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1341 — Nominal Deep-Space Optical & XNAV Lock

```gherkin
SCENARIO: Jupiter-distance spacecraft with 6 pulsars and 3.2 prad Delta-DOR achieves lock
  GIVEN default Deep Space XNAV options at 5.2 AU and SEP angle 24.5 degrees
  WHEN evaluateDeepSpaceOpticalNavEphemeris executes
  THEN regime is "NOMINAL_DEEP_SPACE_LOCK" and combinedPositionUncertaintyKm <= 2.5
```

### BDD-1342 — Solar Conjunction Caution State

```gherkin
SCENARIO: Low Sun-Earth-Probe elongation angle below 5 degrees triggers conjunction caution
  GIVEN sunEarthProbeAngleDeg = 3.2 and nominal position uncertainty <= maxPositionUncertaintyKm
  WHEN evaluateDeepSpaceOpticalNavEphemeris executes
  THEN regime is "SOLAR_CONJUNCTION_CAUTION" and shapiroDelayMicroSec increases significantly
```

### BDD-1343 — Ephemeris Drift Critical Excursion

```gherkin
SCENARIO: Excessive Delta-DOR or XNAV timing residual pushes 3D uncertainty past ceiling
  GIVEN deltaDorResidualPrad = 4500.0 and maxPositionUncertaintyKm = 2.5
  WHEN evaluateDeepSpaceOpticalNavEphemeris executes
  THEN regime is "EPHEMERIS_DRIFT_CRITICAL" and combinedPositionUncertaintyKm > 2.5
```

### BDD-1344 — Pulsar Triangulation Precondition & Digest Determinism

```gherkin
SCENARIO: Fewer than 3 pulsars throws PRECONDITION_FAILED and nominal calls repeat digest identically
  GIVEN pulsarCount = 2 OR default options invoked twice
  WHEN evaluateDeepSpaceOpticalNavEphemeris executes
  THEN pulsarCount = 2 throws PRECONDITION_FAILED and valid calls share identical deepSpaceNavDigestSha256
```

### BDD-1345 — End-to-End CLI `nav:ephemeris` & MCP `deep_space_optical_nav`

```gherkin
SCENARIO: Dispatch Deep Space Optical Nav via CLI and JSON-RPC MCP tools/call
  GIVEN CLI command nav:ephemeris and MCP action "deep_space_optical_nav"
  WHEN invoked via CLI --json and EosMcpServer.handleRequest
  THEN both return regime "NOMINAL_DEEP_SPACE_LOCK" and a 64-hex deepSpaceNavDigestSha256
```
