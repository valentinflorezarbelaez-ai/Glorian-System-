# SPEC-258 — Layer-0 Relativistic Symplectic FODO Twiss Lattice & Luminosity Core

## Metadata

- **SPEC ID**: SPEC-258
- **Change ID**: CHANGE-128
- **Intake ID**: INTAKE-128
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosRelativisticBeamTwissLuminosityCore`

---

## 1. Overview

`EosRelativisticBeamTwissLuminosityCore` solves thin-lens FODO quadrupole transfer matrices symplectically ($\det(M) = 1$, $|\mathrm{Tr}(M)| < 2$), computes relativistic Lorentz $\gamma$ and $\beta$, derives adiabatic geometric emittance and interaction-point RMS beam size $\sigma^*$, evaluates instantaneous collider luminosity ($\mathrm{cm}^{-2}\mathrm{s}^{-1}$), and guards superconducting bending magnets against excessive synchrotron radiation losses.

---

## 2. Functional Requirements (EARS Syntax)

**FR-258-001** (Event-Driven)
WHEN `evaluateRelativisticBeamTwissLuminosity(options)` is invoked, THE SYSTEM SHALL validate `beamEnergyGev > restMassGev > 0`, positive `fodoHalfCellLengthM`, `fodoFocalLengthM`, `normalizedEmittanceUm`, `betaStarM`, `protonsPerBunch`, `revolutionFrequencyHz`, `bendingRadiusM`, `maxSynchrotronLossKev`, positive integer `bunchesPerBeam`, and `0 < crossingAngleReductionFactor <= 1`.

**FR-258-002** (State-Driven)
WHILE propagating lattice optics, THE SYSTEM SHALL construct the 2x2 thin-lens FODO transfer matrix checking `symplecticDeterminant === 1` and stability `|trace| < 2`, calculate FODO phase advance, $\beta_{\max}$, $\beta_{\min}$, adiabatic `geometricEmittanceM`, `ipBeamSigmaUm`, `luminosityCm2s`, and `synchrotronLossKevPerTurn`.

**FR-258-003** (Error Condition)
IF `!fodoStable` (`|fodoMatrixTrace| >= 2`), THEN THE SYSTEM SHALL emit verdict `"LATTICE_RESONANCE_UNSTABLE"`; ELSE IF `synchrotronLossKevPerTurn > maxSynchrotronLossKev`, THEN THE SYSTEM SHALL emit `"SYNCHROTRON_LOSS_ELEVATED"`; ELSE `"BEAM_OPTICS_LUMINOSITY_LOCKED"`.

**FR-258-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable report with `deepFreeze` and a 64-hex `beamOpticsDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1336 — HL-LHC Nominal Symplectic Optics & Luminosity Lock

```gherkin
SCENARIO: 6800 GeV protons in stable FODO lattice achieve symplectic det=1 and luminosity > 1e34
  GIVEN beamEnergyGev = 6800, fodoHalfCellLengthM = 53.45, fodoFocalLengthM = 38.0
  WHEN evaluateRelativisticBeamTwissLuminosity executes
  THEN verdict is "BEAM_OPTICS_LUMINOSITY_LOCKED", fodoStable is true, and luminosityCm2s > 1e34
```

### BDD-1337 — Over-Focused FODO Resonance Instability

```gherkin
SCENARIO: Focal length below half-cell/2 triggers LATTICE_RESONANCE_UNSTABLE
  GIVEN fodoHalfCellLengthM = 53.45 and fodoFocalLengthM = 20.0
  WHEN evaluateRelativisticBeamTwissLuminosity executes
  THEN verdict is "LATTICE_RESONANCE_UNSTABLE" and fodoStable is false
```

### BDD-1338 — Elevated Synchrotron Radiation Loss Escalation

```gherkin
SCENARIO: Excessive beam energy driving radiation loss above threshold emits SYNCHROTRON_LOSS_ELEVATED
  GIVEN stable lattice at beamEnergyGev = 9500 and maxSynchrotronLossKev = 15.0
  WHEN evaluateRelativisticBeamTwissLuminosity executes
  THEN verdict is "SYNCHROTRON_LOSS_ELEVATED" and synchrotronLossKevPerTurn > 15.0
```

### BDD-1339 — Sub-Rest-Mass Validation & Digest Determinism

```gherkin
SCENARIO: Beam energy below rest mass throws precondition Error and nominal digest repeats identically
  GIVEN beamEnergyGev = 0.5 < restMassGev = 0.938272 OR nominal options
  WHEN evaluateRelativisticBeamTwissLuminosity executes
  THEN sub-rest-mass throws Error and nominal options match 64-hex beamOpticsDigestSha256
```

### BDD-1340 — End-to-End CLI `beam:twiss` & JSON-RPC MCP `relativistic_beam_twiss`

```gherkin
SCENARIO: Dispatch Relativistic Beam Twiss Optics via CLI and EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler beam:twiss and MCP action "relativistic_beam_twiss" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both succeed with verdict "BEAM_OPTICS_LUMINOSITY_LOCKED" and a 64-hex beamOpticsDigestSha256
```
