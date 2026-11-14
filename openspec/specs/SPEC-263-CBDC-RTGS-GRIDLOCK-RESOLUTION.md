# SPEC-263 — Layer-0 Wholesale CBDC RTGS Multilateral Gridlock Resolution Core

## Metadata

- **SPEC ID**: SPEC-263
- **Change ID**: CHANGE-129
- **Intake ID**: INTAKE-129
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosCbdcRtgsGridlockResolutionCore`

---

## 1. Overview

`EosCbdcRtgsGridlockResolutionCore` models wholesale Central Bank Digital Currency (CBDC) Real-Time Gross Settlement (RTGS) queues augmented with bilateral and multilateral Liquidity-Saving Mechanisms (LSM), enforcing exact zero-overdraft gross-obligation conservation, computing systemic bank Herfindahl concentration (HHI), and detecting gridlock before finality breaches occur.

---

## 2. Functional Requirements (EARS Syntax)

**FR-263-001** (Event-Driven)
WHEN `evaluateCbdcRtgsGridlockResolution(options)` is invoked, THE SYSTEM SHALL validate non-empty `corridorId`, integer `participantBankCount >= 2`, positive finite `queuedGrossObligationsUsdM` and `availableCentralBankReservesUsdM`, `0 <= bilateralOffsettingEfficiency <= 0.95`, `0 <= multilateralCycleEfficiency <= 0.95`, and `0 < topBankObligationShare, minSettlementThroughputRatio <= 1`.

**FR-263-002** (State-Driven)
WHILE clearing queued wholesale obligations, THE SYSTEM SHALL compute `combinedLsmCompressionFactor`, `netLiquidityRequiredUsdM`, `settledGrossVolumeUsdM`, `settlementThroughputRatio`, `liquidityVelocityMultiplier`, `herfindahlIndex`, and `conservationResidualUsdM`.

**FR-263-003** (Error Condition)
IF `settlementThroughputRatio < minSettlementThroughputRatio`, THEN THE SYSTEM SHALL emit regime `"SYSTEMIC_LIQUIDITY_GRIDLOCK"`; ELSE IF `settlementThroughputRatio < 1.0` OR `herfindahlIndex > 2500`, THEN THE SYSTEM SHALL emit `"PARTIAL_QUEUE_COMPRESSION"`; ELSE `"MULTILATERAL_LSM_CLEARED"`.

**FR-263-004** (Ubiquitous)
THE SYSTEM SHALL preserve exact balance conservation (`conservationResidualUsdM === 0`) and seal the immutable assessment with `deepFreeze` and a 64-hex `cbdcRtgsDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1361 — Multilateral LSM Full Queue Clearance

```gherkin
SCENARIO: 18 participant banks with LSM netting clear 100% of queued gross obligations
  GIVEN default CBDC RTGS options with 16500 USD M reserves and multilateral cycle netting
  WHEN evaluateCbdcRtgsGridlockResolution executes
  THEN regime is "MULTILATERAL_LSM_CLEARED", settlementThroughputRatio === 1, and conservationResidualUsdM === 0
```

### BDD-1362 — Partial Queue Compression or High Bank Concentration

```gherkin
SCENARIO: Moderately constrained reserves above 85% floor yield partial queue compression
  GIVEN availableCentralBankReservesUsdM = 14000 and minSettlementThroughputRatio = 0.85
  WHEN evaluateCbdcRtgsGridlockResolution executes
  THEN regime is "PARTIAL_QUEUE_COMPRESSION" and 0.85 <= settlementThroughputRatio < 1.0
```

### BDD-1363 — Systemic Liquidity Gridlock Circuit Breaker

```gherkin
SCENARIO: Severe central bank reserve shortage drops throughput below minimum SLA
  GIVEN availableCentralBankReservesUsdM = 4500.0 with default 48500 USD M queue
  WHEN evaluateCbdcRtgsGridlockResolution executes
  THEN regime is "SYSTEMIC_LIQUIDITY_GRIDLOCK" and settlementThroughputRatio < minSettlementThroughputRatio
```

### BDD-1364 — Participant Count Precondition & Exact Conservation

```gherkin
SCENARIO: Single participant bank throws PRECONDITION_FAILED and valid calls conserve obligations
  GIVEN participantBankCount = 1 OR valid clearing run repeated twice
  WHEN evaluateCbdcRtgsGridlockResolution executes
  THEN participantBankCount = 1 throws PRECONDITION_FAILED and cbdcRtgsDigestSha256 repeats identically
```

### BDD-1365 — End-to-End CLI `rtgs:clear` & MCP `cbdc_rtgs_gridlock`

```gherkin
SCENARIO: Dispatch CBDC RTGS Gridlock via CLI and JSON-RPC MCP tools/call
  GIVEN CLI command rtgs:clear and MCP action "cbdc_rtgs_gridlock"
  WHEN invoked via CLI --json and EosMcpServer.handleRequest
  THEN both return regime "MULTILATERAL_LSM_CLEARED" and a 64-hex cbdcRtgsDigestSha256
```
