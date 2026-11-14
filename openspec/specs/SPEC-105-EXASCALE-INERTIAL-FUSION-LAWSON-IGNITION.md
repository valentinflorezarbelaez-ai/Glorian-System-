# SPEC-105 — Layer-0 Exascale Inertial Fusion Lawson Ignition & Energy Balance Core

## Metadata

- **SPEC ID**: SPEC-105
- **Change ID**: CHANGE-127
- **Intake ID**: INTAKE-127
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosInertialFusionLawsonIgnitionCore`

---

## 1. Overview

`EosInertialFusionLawsonIgnitionCore` models inertial/magnetic D-T fusion burn physics: it computes the Lawson triple product ($n \tau_E T_{\text{keV}}$), Bosch-Hale parametric D-T reactivity $\langle \sigma v \rangle(T)$, alpha particle self-heating power $P_\alpha$, Bremsstrahlung radiative + transport conduction power loss, scientific plasma gain $Q_{\text{plasma}}$, implosion P2/P0 Legendre symmetry margin, and strict power conservation balance.

---

## 2. Functional Requirements (EARS Syntax)

**FR-105-001** (Event-Driven)
WHEN `evaluateLawsonIgnitionAndBurn(options)` is invoked, THE SYSTEM SHALL enforce strictly positive `electronDensityM3`, `confinementTimeSec`, `ionTemperatureKeV` (`1..150` keV), and `externalHeatingMw`.

**FR-105-002** (State-Driven)
WHILE evaluating plasma ignition margins, THE SYSTEM SHALL calculate `tripleProductKeVSecPerM3 = n_m3 * tau_s * T_keV`, D-T fusion power `fusionYieldMw`, alpha heating `alphaHeatingMw = 0.2 * fusionYieldMw`, and radiative + transport losses `totalLossMw`.

**FR-105-003** (Ubiquitous)
THE SYSTEM SHALL enforce power balance closure `energyBalanceResidualRatio = |totalLossMw - (alphaHeatingMw + externalHeatingMw + netSurplusMw)| / max(totalPowerScale, 1)`, ensuring `energyBalanceResidualRatio < 1e-6`.

**FR-105-004** (Error Condition)
IF `implosionAsymmetryP2OverP0 > 0.15` OR (`alphaHeatingMw < totalLossMw` AND `plasmaGainQ < 1.0`), THEN THE SYSTEM SHALL emit `"QUENCHED_BELOW_BREAKEVEN"`; ELSE IF `alphaHeatingMw >= totalLossMw` AND `plasmaGainQ >= 5.0` AND `tripleProductKeVSecPerM3 >= 3e21`, THEN emit `"IGNITION_SELF_SUSTAINING"`; ELSE `"BURNING_PLASMA_SUB_IGNITION"`.

**FR-105-005** (Ubiquitous)
THE SYSTEM SHALL freeze the output contract via `deepFreeze` and attach a 64-hex `fusionDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1311 — Self-Sustaining D-T Ignition (`IGNITION_SELF_SUSTAINING`)

```gherkin
SCENARIO: Nominal NIF/LLNL hotspot achieves self-sustaining alpha heating above Lawson criterion
  GIVEN hotspot density, confinement time, and 18 keV temperature with low P2/P0 asymmetry
  WHEN evaluateLawsonIgnitionAndBurn executes
  THEN verdict is "IGNITION_SELF_SUSTAINING", alphaHeatingMw >= totalLossMw, and tripleProductKeVSecPerM3 >= 3e21
```

### BDD-1312 — Burning Plasma Sub-Ignition Regime (`Q >= 1` Without Self-Sustaining Alpha Closure)

```gherkin
SCENARIO: Moderate confinement produces Q >= 1 burning plasma requiring external heating
  GIVEN intermediate confinement time yielding Q_plasma >= 1.5 with alphaHeatingMw < totalLossMw
  WHEN evaluateLawsonIgnitionAndBurn executes
  THEN verdict is "BURNING_PLASMA_SUB_IGNITION" and plasmaGainQ >= 1
```

### BDD-1313 — Implosion Asymmetry or Radiative Quench Falls Below Breakeven

```gherkin
SCENARIO: Excessive P2/P0 asymmetry or cold plasma triggers QUENCHED_BELOW_BREAKEVEN
  GIVEN implosionAsymmetryP2OverP0 = 0.25 OR ionTemperatureKeV = 2.5
  WHEN evaluateLawsonIgnitionAndBurn executes
  THEN verdict is "QUENCHED_BELOW_BREAKEVEN"
```

### BDD-1314 — Physical Bound Guard, Energy Conservation & Deterministic Digest

```gherkin
SCENARIO: Reject non-physical negative density and verify zero energy-balance residual
  GIVEN electronDensityM3 <= 0 OR nominal valid shot
  WHEN evaluateLawsonIgnitionAndBurn runs
  THEN invalid density throws Error, while valid shots maintain energyBalanceResidualRatio < 1e-6 and repeatable fusionDigestSha256
```

### BDD-1315 — End-to-End CLI `fusion:ignite` & JSON-RPC MCP `lawson_fusion_ignite`

```gherkin
SCENARIO: Dispatch Lawson Fusion Core via CLI and full EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler fusion:ignite and MCP action "lawson_fusion_ignite" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both return verdict "IGNITION_SELF_SUSTAINING" and a 64-hex fusionDigestSha256
```
