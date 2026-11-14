# SPEC-249 — Layer-0 Aladdin Systemic Risk & Correlated Contagion Stress Engine

## Metadata

- **SPEC ID**: SPEC-249
- **Change ID**: CHANGE-124
- **Intake ID**: INTAKE-124
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-13
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosAladdinSystemicRiskStressCore`

---

## 1. Overview

`EosAladdinSystemicRiskStressCore` performs seeded Monte Carlo tail-risk and correlated infrastructure contagion simulations across the registered Glorian fleet (`docs/projects/registry.json`), computing `expectedAvailabilityPercent`, `VaR 95%`, `VaR 99%`, `Expected Shortfall (CVaR 99%)`, and `contagionAmplificationFactor`.

---

## 2. Functional Requirements (EARS Syntax)

**FR-249-001** (Event-Driven)
WHEN `runSystemicStressSimulation(options)` is called, THE SYSTEM SHALL resolve the portfolio size from the confined fleet registry (or `portfolioCountOverride`), clamp `trials` to `[10, 5000]`, and run deterministic `xorshift32(seed)` trials incorporating independent node shocks and correlated cascade contagion.

**FR-249-002** (State-Driven)
THE SYSTEM SHALL sort trial portfolio outage percentages and report `valueAtRisk95Percent`, `valueAtRisk99Percent`, `expectedShortfall99Percent >= valueAtRisk99Percent`, `expectedAvailabilityPercent`, and `contagionAmplificationFactor >= 1`.

**FR-249-003** (State-Driven & Error Condition)
IF `registryRelPath` resolves outside `projectRoot`, THEN THE SYSTEM SHALL fail closed by throwing `Path traversal outside projectRoot is forbidden`. WHILE `valueAtRisk99Percent <= 25`, `riskTier` SHALL be `"RESILIENT_AAA"`; `<= 50`, `"GUARDED_AA"`; otherwise `"SYSTEMIC_CRITICAL"`.

**FR-249-004** (Ubiquitous)
THE SYSTEM SHALL emit actionable `circuitBreakerDirectives`, deep-freeze the output, and compute a deterministic 64-hex `aladdinDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1266 — Evaluates Baseline 9-Project Fleet As RESILIENT_AAA Or GUARDED_AA Non-Critical

```gherkin
SCENARIO: Execute seeded systemic stress simulation over the 9 registered fleet projects
  GIVEN default registry path and default shockProbability / contagionCoupling parameters
  WHEN EosAladdinSystemicRiskStressCore.runSystemicStressSimulation executes
  THEN portfolioSize is 9, trialsExecuted is 200, expectedShortfall99Percent >= valueAtRisk99Percent, and riskTier is not "SYSTEMIC_CRITICAL"
```

### BDD-1267 — Surfaces SYSTEMIC_CRITICAL Tail Risk Under Extreme Correlated Shock

```gherkin
SCENARIO: Detect VaR 99% and CVaR spike under high correlated shock regime
  GIVEN shockProbability = 0.45 and contagionCoupling = 0.75
  WHEN runSystemicStressSimulation runs
  THEN riskTier is "SYSTEMIC_CRITICAL" and circuitBreakerDirectives recommends isolation
```

### BDD-1268 — Preserves Mathematical Quantile Ordering (VaR 95 <= VaR 99 <= CVaR 99)

```gherkin
SCENARIO: Guarantee coherent risk metric ordering across arbitrary stress regimes
  GIVEN valid Monte Carlo parameters
  WHEN runSystemicStressSimulation runs
  THEN valueAtRisk95Percent <= valueAtRisk99Percent <= expectedShortfall99Percent
```

### BDD-1269 — Rejects Path Traversal On registryRelPath

```gherkin
SCENARIO: Fail closed when registryRelPath escapes projectRoot
  GIVEN registryRelPath = "../../etc/passwd"
  WHEN runSystemicStressSimulation executes
  THEN the call throws "Path traversal outside projectRoot is forbidden"
```

### BDD-1270 — Produces Repeatable Metrics & SHA-256 Digest + CLI/MCP Integration

```gherkin
SCENARIO: Emit deterministic digest for fixed seed and verify CLI/MCP wiring and ship SHIP_APPROVED
  GIVEN identical seed executed twice plus eda:prove, apollo:bundle, aladdin:stress, and ship --ticket=SPOT-249 --json
  WHEN executed on clean tree or via MCP dispatch
  THEN digests match identically and master ship verdict is "SHIP_APPROVED"
```
