# SPEC-261 — Layer-0 Subsea Coherent DWDM Nonlinear Shannon Core

## Metadata

- **SPEC ID**: SPEC-261
- **Change ID**: CHANGE-129
- **Intake ID**: INTAKE-129
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosSubseaCoherentDwdmNonlinearShannonCore`

---

## 1. Overview

`EosSubseaCoherentDwdmNonlinearShannonCore` evaluates transoceanic multi-span coherent optical DWDM links using the Gaussian Noise (GN) Kerr nonlinear interference model ($P_{\text{NLI}}$), EDFA amplified spontaneous emission (ASE) noise accumulation, Generalized SNR ($\text{GSNR}$), dual-polarization spectral efficiency, and total cable fiber-pair capacity in Tbps.

---

## 2. Functional Requirements (EARS Syntax)

**FR-261-001** (Event-Driven)
WHEN `evaluateSubseaCoherentDwdmNonlinearShannon(options)` is invoked, THE SYSTEM SHALL validate non-empty `cableId`, integer `spanCount >= 1`, integer `wDMChannelCount >= 1`, positive finite `spanLengthKm`, `fiberAttenuationDbPerKm`, `edfaNoiseFigureDb`, `channelBaudRateGbaud`, `nonlinearKerrCoeffPerWKm`, `minGeneralizedSnrDb`, and `-20 <= launchPowerDbm <= 15`.

**FR-261-002** (State-Driven)
WHILE modeling optical transmission across spans, THE SYSTEM SHALL compute `effectiveLengthKm`, `aseNoisePowerWatts`, `kerrNliPowerWatts`, `generalizedSnrDb`, `spectralEfficiencyBpsPerHz`, and `totalFiberPairCapacityTbps`.

**FR-261-003** (Error Condition)
IF `generalizedSnrDb < minGeneralizedSnrDb`, THEN THE SYSTEM SHALL emit regime `"OSNR_BELOW_FEC_THRESHOLD"`; ELSE IF `kerrNliPowerWatts > 0.55 * aseNoisePowerWatts`, THEN THE SYSTEM SHALL emit `"KERR_NONLINEAR_SATURATION"`; ELSE `"OPTIMAL_NONLINEAR_SHANNON"`.

**FR-261-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable assessment with `deepFreeze` and a 64-hex `subseaDwdmDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1351 — Optimal Transatlantic Coherent DWDM Shannon Link

```gherkin
SCENARIO: 82x80 km coherent SDM link at -0.5 dBm achieves optimal nonlinear Shannon capacity
  GIVEN default Subsea DWDM Shannon options
  WHEN evaluateSubseaCoherentDwdmNonlinearShannon executes
  THEN regime is "OPTIMAL_NONLINEAR_SHANNON" and generalizedSnrDb >= 11.5
```

### BDD-1352 — Kerr Nonlinear Saturation Regime

```gherkin
SCENARIO: Over-launching optical power drives Kerr NLI past 55% of ASE noise
  GIVEN launchPowerDbm = 2.0 with sufficient GSNR above FEC floor
  WHEN evaluateSubseaCoherentDwdmNonlinearShannon executes
  THEN regime is "KERR_NONLINEAR_SATURATION" and kerrNliPowerWatts > 0.55 * aseNoisePowerWatts
```

### BDD-1353 — OSNR Below FEC Threshold Failure

```gherkin
SCENARIO: Excessive span count drops GSNR below soft-decision FEC threshold
  GIVEN spanCount = 320 and launchPowerDbm = -4.0
  WHEN evaluateSubseaCoherentDwdmNonlinearShannon executes
  THEN regime is "OSNR_BELOW_FEC_THRESHOLD" and generalizedSnrDb < minGeneralizedSnrDb
```

### BDD-1354 — Launch Power Bounds & Digest Determinism

```gherkin
SCENARIO: Out-of-bounds launch power throws PRECONDITION_FAILED and valid calls repeat digest
  GIVEN launchPowerDbm = 25.0 OR nominal options called twice
  WHEN evaluateSubseaCoherentDwdmNonlinearShannon executes
  THEN out-of-range throws PRECONDITION_FAILED and valid calls yield identical subseaDwdmDigestSha256
```

### BDD-1355 — End-to-End CLI `dwdm:shannon` & MCP `subsea_dwdm_shannon`

```gherkin
SCENARIO: Dispatch Subsea DWDM Shannon via CLI and JSON-RPC MCP tools/call
  GIVEN CLI command dwdm:shannon and MCP action "subsea_dwdm_shannon"
  WHEN invoked via CLI --json and EosMcpServer.handleRequest
  THEN both return regime "OPTIMAL_NONLINEAR_SHANNON" and a 64-hex subseaDwdmDigestSha256
```
