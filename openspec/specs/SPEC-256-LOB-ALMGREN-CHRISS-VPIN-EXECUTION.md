# SPEC-256 — Layer-0 Limit Order Book Almgren-Chriss Execution & VPIN Core

## Metadata

- **SPEC ID**: SPEC-256
- **Change ID**: CHANGE-128
- **Intake ID**: INTAKE-128
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-14
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosLobAlmgrenChrissVpinCore`

---

## 1. Overview

`EosLobAlmgrenChrissVpinCore` optimizes multi-slice institutional order execution using the continuous/discrete Almgren-Chriss hyperbolic-sine trajectory under permanent and temporary market impact alongside volume-synchronized probability of informed trading (VPIN) flow toxicity detection.

---

## 2. Functional Requirements (EARS Syntax)

**FR-256-001** (Event-Driven)
WHEN `evaluateLobAlmgrenChrissVpin(options)` is invoked, THE SYSTEM SHALL validate strictly positive `bestBidPrice` and `bestAskPrice > bestBidPrice`, positive `orderSizeShares`, positive integer `horizonSlices`, non-negative volatility and impact coefficients, positive thresholds, and at least one non-empty volume bucket.

**FR-256-002** (State-Driven)
WHILE synthesizing the execution schedule, THE SYSTEM SHALL compute the optimal hyperbolic-sine inventory trajectory across `horizonSlices` guaranteeing exact share conservation (`sum(scheduledSlices) === orderSizeShares`), decompose expected half-spread, temporary impact, and permanent impact cost into `expectedShortfallBps`, and compute `vpin = sum(|buyVolume - sellVolume|) / sum(buyVolume + sellVolume)`.

**FR-256-003** (Error Condition)
IF `vpin >= vpinToxicityThreshold`, THEN THE SYSTEM SHALL halt with verdict `"TOXIC_FLOW_VPIN_HALT"`; ELSE IF `expectedShortfallBps > maxImpactBpsThreshold` OR `spreadBps > maxImpactBpsThreshold`, THEN THE SYSTEM SHALL emit `"HIGH_MARKET_IMPACT_WARN"`; ELSE `"EXECUTION_TRAJECTORY_OPTIMAL"`.

**FR-256-004** (Ubiquitous)
THE SYSTEM SHALL seal the immutable report with `deepFreeze` and a 64-hex `lobVpinDigestSha256`.

---

## 3. BDD Acceptance Scenarios

### BDD-1326 — Optimal Almgren-Chriss Trajectory & Share Conservation

```gherkin
SCENARIO: Balanced order book flow yields optimal trajectory preserving exact share sum
  GIVEN valid bid/ask, 50000 shares, 10 horizon slices, and balanced volume buckets
  WHEN evaluateLobAlmgrenChrissVpin executes
  THEN verdict is "EXECUTION_TRAJECTORY_OPTIMAL" and sum(scheduledSlices) equals 50000
```

### BDD-1327 — Toxic Informed Flow Circuit Breaker (`VPIN`)

```gherkin
SCENARIO: Severely imbalanced buy/sell volume buckets trigger TOXIC_FLOW_VPIN_HALT
  GIVEN volumeBuckets dominated 90% buy vs 10% sell yielding vpin = 0.8 >= 0.45
  WHEN evaluateLobAlmgrenChrissVpin executes
  THEN verdict is "TOXIC_FLOW_VPIN_HALT"
```

### BDD-1328 — Excessive Spread or Temporary Impact Warning

```gherkin
SCENARIO: Wide bid-ask spread above maxImpactBpsThreshold emits HIGH_MARKET_IMPACT_WARN
  GIVEN balanced buckets with bestBidPrice = 100.0 and bestAskPrice = 100.40 (spread ~ 40 bps > 25 bps)
  WHEN evaluateLobAlmgrenChrissVpin executes
  THEN verdict is "HIGH_MARKET_IMPACT_WARN"
```

### BDD-1329 — Crossed Book Precondition Guard & Deterministic Digest

```gherkin
SCENARIO: Crossed or locked book (ask <= bid) throws and identical calls yield same digest
  GIVEN bestAskPrice <= bestBidPrice OR nominal options
  WHEN evaluateLobAlmgrenChrissVpin executes
  THEN crossed book throws Error and valid calls produce deterministic 64-hex lobVpinDigestSha256
```

### BDD-1330 — End-to-End CLI `lob:vpin` & JSON-RPC MCP `lob_almgren_chriss_vpin`

```gherkin
SCENARIO: Dispatch Almgren-Chriss & VPIN via CLI and EosMcpServer JSON-RPC tools/call
  GIVEN wired CLI handler lob:vpin and MCP action "lob_almgren_chriss_vpin" on eos_enterprise_workspace
  WHEN invoked via CLI --json and EosMcpServer.handleRequest tools/call
  THEN both succeed with verdict "EXECUTION_TRAJECTORY_OPTIMAL" and a 64-hex lobVpinDigestSha256
```
