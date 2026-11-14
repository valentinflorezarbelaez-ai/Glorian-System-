# SPEC-265 — Layer-0 Interferometric SAR Crustal Deformation & Coherence Core

## Metadata

- **SPEC ID**: SPEC-265
- **Change ID**: CHANGE-130
- **Intake ID**: INTAKE-130
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosInterferometricSarDeformationCore`

---

## 1. Overview

`EosInterferometricSarDeformationCore` models orbital Synthetic Aperture Radar Interferometry (InSAR) repeat-pass crustal deformation inversion, computing critical perpendicular baseline decorrelation limits, geometric/temporal/thermal interferometric coherence decomposition ($\gamma_{\text{total}}$), altitude of ambiguity, millimeter-scale line-of-sight surface displacement, and Cramer-Rao phase-noise uncertainty.

---

## 2. Functional Requirements (EARS Syntax)

**FR-265-001** (Event-Driven)
WHEN `evaluateInterferometricSarDeformation(options)` is invoked, THE SYSTEM SHALL validate non-empty `passPairId`, positive finite `radarWavelengthMeters`, `slantRangeKm`, `rangeResolutionMeters`, `perpendicularBaselineMeters`, `decorrelationTimeConstantDays`, `thermalSnrDb`, `5 < incidenceAngleDeg <= 85`, `temporalBaselineDays >= 0`, finite `unwrappedPhaseRad`, and `0 < minCoherenceThreshold <= 1`.

**FR-265-002** (State-Driven)
WHILE evaluating repeat-pass interferometric coherence and phase unwrapping, THE SYSTEM SHALL compute `criticalBaselineMeters`, `geometricCoherence`, `temporalCoherence`, `thermalCoherence`, `totalCoherence`, `ambiguityHeightMeters`, `losDisplacementMm`, and `displacementUncertaintyMm`.

**FR-265-003** (Error Condition)
IF `totalCoherence < minCoherenceThreshold`, THEN THE SYSTEM SHALL emit regime `"BASELINE_DECORRELATION_CRITICAL"`; ELSE IF `totalCoherence < 0.65`, THEN THE SYSTEM SHALL emit `"TEMPORAL_DECORRELATION_WARNING"`; ELSE `"PHASE_UNWRAPPED_COHERENT"`.

**FR-265-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable assessment with `deepFreeze` and a 64-hex `insarDeformationDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1371 — Coherent C-Band Tandem Phase Unwrapping

```gherkin
SCENARIO: 12-day C-band repeat pass with 180 m perpendicular baseline achieves coherent unwrapping
  GIVEN default Interferometric SAR Deformation options
  WHEN evaluateInterferometricSarDeformation executes
  THEN regime is "PHASE_UNWRAPPED_COHERENT" and totalCoherence >= 0.65
```

### BDD-1372 — Temporal Decorrelation Warning State

```gherkin
SCENARIO: Extended 28-day temporal baseline reduces total coherence into warning band
  GIVEN temporalBaselineDays = 28.0 with default radar and baseline parameters
  WHEN evaluateInterferometricSarDeformation executes
  THEN regime is "TEMPORAL_DECORRELATION_WARNING" and minCoherenceThreshold <= totalCoherence < 0.65
```

### BDD-1373 — Baseline Decorrelation Critical Loss

```gherkin
SCENARIO: Excessive perpendicular baseline exceeding 3600 m collapses coherence below threshold
  GIVEN perpendicularBaselineMeters = 3200.0 driving totalCoherence < 0.45
  WHEN evaluateInterferometricSarDeformation executes
  THEN regime is "BASELINE_DECORRELATION_CRITICAL" and totalCoherence < minCoherenceThreshold
```

### BDD-1374 — Incidence Angle Precondition & Digest Determinism

```gherkin
SCENARIO: Out-of-bounds incidenceAngleDeg throws PRECONDITION_FAILED and valid calls repeat digest
  GIVEN incidenceAngleDeg = 92.0 OR nominal options invoked twice
  WHEN evaluateInterferometricSarDeformation executes
  THEN invalid angle throws PRECONDITION_FAILED and valid calls share identical insarDeformationDigestSha256
```

### BDD-1375 — End-to-End CLI `insar:deform` & MCP `insar_crustal_deformation`

```gherkin
SCENARIO: Dispatch InSAR Crustal Deformation via CLI and JSON-RPC MCP tools/call
  GIVEN CLI command insar:deform and MCP action "insar_crustal_deformation"
  WHEN invoked via CLI --json and EosMcpServer.handleRequest
  THEN both return regime "PHASE_UNWRAPPED_COHERENT" and a 64-hex insarDeformationDigestSha256
```
