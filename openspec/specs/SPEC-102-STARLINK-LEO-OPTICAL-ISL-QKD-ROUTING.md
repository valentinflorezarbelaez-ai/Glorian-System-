# SPEC-102 — Layer-0 LEO Constellation Optical ISL & Satellite QKD Routing Core

## Metadata

- **SPEC ID**: SPEC-102
- **Change ID**: CHANGE-127
- **Intake ID**: INTAKE-127
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosLeoConstellationOpticalRoutingCore`

---

## 1. Overview

`EosLeoConstellationOpticalRoutingCore` models a Walker-Delta Low Earth Orbit optical mesh, computes minimum-latency inter-satellite laser link (ISL) shortest paths via Dijkstra with degraded-link isolation, quantifies vacuum optical latency advantage over terrestrial single-mode fiber ($n_{\text{fiber}} \approx 1.468$), computes kinematic Doppler frequency shift $\Delta f / f_0$, and audits BB84 satellite quantum key distribution (QKD) secret key budgets under QBER thresholds.

---

## 2. Functional Requirements (EARS Syntax)

**FR-102-001** (Event-Driven)
WHEN `planOpticalIslRouteAndQkdBudget(options)` is invoked, THE SYSTEM SHALL validate `altitudeKm` within `[300, 2000]` and non-empty source/destination satellite identifiers, rejecting out-of-bounds orbital parameters fail-closed.

**FR-102-002** (State-Driven)
WHILE routing from `sourceNodeId` to `destinationNodeId`, THE SYSTEM SHALL construct an undirected optical ISL graph excluding links flagged `degraded: true` and select the path minimizing cumulative propagation plus switching latency (`routePath`, `totalDistanceKm`, `opticalLatencyMs`).

**FR-102-003** (Ubiquitous)
THE SYSTEM SHALL compute terrestrial equivalent fiber latency (`fiberEquivalentLatencyMs`, speed $c / 1.468$), `vacuumSpeedupRatio`, orbital velocity $v = \sqrt{\mu / (R_E + h)}$, and optical Doppler shift `dopplerShiftRatio = v_rel / c`.

**FR-102-004** (Event-Driven & Error Condition)
IF no healthy ISL path exists between source and destination, THEN THE SYSTEM SHALL report `CONSTELLATION_LINK_SEVERED` with zero reachable hops; ELSE IF BB84 QBER `>= 0.11` or fallback rerouting was required over non-primary links, THEN classify `"ISL_REROUTED_DEGRADED"`; ELSE classify `"ISL_QUANTUM_LINK_LOCKED"`.

**FR-102-005** (Ubiquitous)
THE SYSTEM SHALL seal the immutable report with `deepFreeze` and deterministic 64-hex `leoRouteDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1296 — Nominal Optical ISL Route & Vacuum Speedup over Fiber

```gherkin
SCENARIO: Locked nominal Walker-Delta optical ISL path beats terrestrial fiber latency
  GIVEN default 550 km LEO constellation and nominal BB84 QBER (< 0.11)
  WHEN planOpticalIslRouteAndQkdBudget executes
  THEN verdict is "ISL_QUANTUM_LINK_LOCKED", opticalLatencyMs < fiberEquivalentLatencyMs, and secretKeyRateKbps > 0
```

### BDD-1297 — Autonomous Rerouting Around Degraded ISL Laser Link

```gherkin
SCENARIO: Dijkstra bypasses degraded primary laser hop cleanly
  GIVEN primary optical link SAT-A <-> SAT-C marked degraded with healthy backup SAT-A <-> SAT-B <-> SAT-C
  WHEN planOpticalIslRouteAndQkdBudget routes from SAT-A to SAT-C
  THEN verdict is "ISL_REROUTED_DEGRADED" and routePath traverses SAT-B without failing
```

### BDD-1298 — Severed Constellation Detection

```gherkin
SCENARIO: Disconnected destination triggers CONSTELLATION_LINK_SEVERED
  GIVEN all incident links to destination satellite marked degraded
  WHEN planOpticalIslRouteAndQkdBudget routes to destination
  THEN verdict is "CONSTELLATION_LINK_SEVERED" and routeReachable is false
```

### BDD-1299 — Orbital Altitude Bounds & BB84 QBER Security Threshold

```gherkin
SCENARIO: Reject out-of-envelope altitudes and zero out secret key rate above 11% QBER
  GIVEN altitudeKm = 120 OR qber = 0.13 on active optical link
  WHEN planOpticalIslRouteAndQkdBudget is invoked
  THEN invalid altitude throws RangeError/Error, while qber = 0.13 clamps qkdSecretKeyRateKbps to 0
```

### BDD-1300 — End-to-End CLI `leo:route` & JSON-RPC MCP `starlink_leo_route`

```gherkin
SCENARIO: Dispatch LEO Optical ISL Routing via CLI and full EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler leo:route and MCP action "starlink_leo_route" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both return verdict "ISL_QUANTUM_LINK_LOCKED" and deterministic leoRouteDigestSha256
```
