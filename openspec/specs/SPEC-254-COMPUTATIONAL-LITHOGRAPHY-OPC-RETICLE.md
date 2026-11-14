# SPEC-254 — Layer-0 High-NA EUV Computational Lithography & OPC Reticle Mask Core

## Metadata

- **SPEC ID**: SPEC-254
- **Change ID**: CHANGE-128
- **Intake ID**: INTAKE-128
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosComputationalLithographyOpcCore`

---

## 1. Overview

`EosComputationalLithographyOpcCore` models ASML High-NA EUV computational lithography optics, Rayleigh resolution limits ($k_1 \lambda / \mathrm{NA}$), Normalized Image Log-Slope (NILS), Mask Error Enhancement Factor (MEEF), depth of focus (DoF), and iterative inverse Optical Proximity Correction (OPC) Edge Placement Error (EPE) convergence.

---

## 2. Functional Requirements (EARS Syntax)

**FR-254-001** (Event-Driven)
WHEN `evaluateComputationalLithographyOpc(options)` is invoked, THE SYSTEM SHALL validate that `wavelengthNm > 0`, `0 < numericalAperture < 1.5`, `0.25 <= k1ProcessFactor <= 1.0`, `targetCdNm > 0`, `targetPitchNm > 0`, `0 < maskContrast <= 1`, `opcIterations >= 1` integer, `initialEpeNm >= 0`, `maxEpeToleranceNm > 0`, `reticleErrorEnhancementFactor >= 1.0`, and `doseFocusWindowPct >= 0`, throwing a precondition error on violation.

**FR-254-002** (State-Driven)
WHILE computing optical and reticle metrics, THE SYSTEM SHALL evaluate `rayleighHalfPitchNm = (k1ProcessFactor * wavelengthNm) / numericalAperture`, `nils = Math.PI * maskContrast * (targetCdNm / rayleighHalfPitchNm)`, `depthOfFocusNm = 0.5 * (wavelengthNm / (numericalAperture * numericalAperture))`, `residualEpeNm = initialEpeNm * Math.pow(0.55, opcIterations)`, and `effectiveMef = reticleErrorEnhancementFactor * (rayleighHalfPitchNm / targetCdNm)`.

**FR-254-003** (Error Condition)
IF `targetCdNm < 0.75 * rayleighHalfPitchNm` OR `targetPitchNm < 1.5 * rayleighHalfPitchNm` OR `nils < 1.2` OR `residualEpeNm > maxEpeToleranceNm * 3.5`, THEN THE SYSTEM SHALL emit verdict `"DIFFRACTION_LIMIT_BREACH"`; ELSE IF `residualEpeNm > maxEpeToleranceNm` OR `nils < 1.8` OR `doseFocusWindowPct < 5.0`, THEN THE SYSTEM SHALL emit `"SRAF_ASSIST_REQUIRED"`; ELSE `"LITHO_OPC_CONVERGED"`.

**FR-254-004** (Ubiquitous)
THE SYSTEM SHALL seal the returned `ComputationalLithographyOpcReport` with `deepFreeze` and a deterministic 64-hex `opcDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1316 — High-NA EUV Nominal OPC Convergence

```gherkin
SCENARIO: 2nm High-NA EUV nominal optics and 6 OPC iterations converge within EPE tolerance
  GIVEN wavelengthNm = 13.5, numericalAperture = 0.55, k1ProcessFactor = 0.32, targetCdNm = 8.0, opcIterations = 6
  WHEN evaluateComputationalLithographyOpc executes
  THEN verdict is "LITHO_OPC_CONVERGED", nils >= 1.8, and residualEpeNm <= 0.25
```

### BDD-1317 — Under-Iterated OPC Escalates to SRAF Assist

```gherkin
SCENARIO: Insufficient OPC iterations leaves residual EPE above tolerance requiring SRAF assist
  GIVEN opcIterations = 2 with initialEpeNm = 1.8 and maxEpeToleranceNm = 0.25
  WHEN evaluateComputationalLithographyOpc executes
  THEN verdict is "SRAF_ASSIST_REQUIRED" and residualEpeNm > 0.25
```

### BDD-1318 — Sub-Diffraction Pitch/CD Violation Halts Patterning

```gherkin
SCENARIO: Target critical dimension below 0.75 * rayleighHalfPitch triggers DIFFRACTION_LIMIT_BREACH
  GIVEN targetCdNm = 3.0 under wavelengthNm = 13.5 and numericalAperture = 0.55
  WHEN evaluateComputationalLithographyOpc executes
  THEN verdict is "DIFFRACTION_LIMIT_BREACH"
```

### BDD-1319 — Physical Lower Bound & Deterministic Digest

```gherkin
SCENARIO: Violating Abbe k1 lower bound throws and repeated nominal calls match digest
  GIVEN k1ProcessFactor = 0.1 OR valid repeated options
  WHEN evaluateComputationalLithographyOpc executes
  THEN k1 < 0.25 throws Error and repeated calls yield identical 64-hex opcDigestSha256
```

### BDD-1320 — End-to-End CLI `litho:opc` & JSON-RPC MCP `asml_opc_lithography`

```gherkin
SCENARIO: Dispatch Computational Lithography OPC via CLI and EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler litho:opc and MCP action "asml_opc_lithography" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both succeed with verdict "LITHO_OPC_CONVERGED" and a 64-hex opcDigestSha256
```
