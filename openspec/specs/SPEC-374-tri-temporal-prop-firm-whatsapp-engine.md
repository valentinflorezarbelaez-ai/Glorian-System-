# SPEC-374: Sovereign Autonomous Prop-Firm Trader, Tri-Temporal Fractal Engine & Real-Time WhatsApp Dispatcher

- **Specification ID**: SPEC-374
- **Change Reference**: CHANGE-236
- **Intake Reference**: INTAKE-236
- **Domain**: Multi-Timeframe Quantitative Trading, Prop-Firm Governance & Mobile Notification
- **Status**: FORMALIZED
- **Version**: 1.0.0

---

## 1. Functional Requirements (IEEE 830 EARS)

### FR-374-01: Tri-Temporal Fractal Alignment Evaluation

- **Pattern**: Event-Driven
- **Requirement**: WHEN a trade setup is evaluated across M15, M5, and M1 timeframes, THE SYSTEM SHALL verify that M15 macro trend bias, M5 structural Fibonacci wave, and M1 BinaryTeach trigger are in harmonic agreement, rejecting any setup where any timeframe conflicts.

### FR-374-02: Prop-Firm & FTMO Drawdown Governor

- **Pattern**: State-Driven
- **Requirement**: WHILE evaluating capital and account state, THE SYSTEM SHALL enforce a daily maximum drawdown limit of 4.5% and a total cumulative drawdown limit of 9.0%, halting trading operations immediately if either boundary is reached.

### FR-374-03: Challenge Profit Target & Progress Tracking

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM SHALL track simulated cumulative equity toward the institutional +10.0% challenge profit target and emit progress milestones.

### FR-374-04: Formatted WhatsApp Trade Alert Dispatcher

- **Pattern**: Event-Driven
- **Requirement**: WHEN an autonomous trade is executed, THE SYSTEM SHALL generate a structured WhatsApp message payload detailing asset pair, direction, entry price, expiry, confluence score, and 3-timeframe technical breakdown.

### FR-374-05: Real-Time Trade Outcome & PnL Notification

- **Pattern**: Event-Driven
- **Requirement**: WHEN an active trade expires, THE SYSTEM SHALL compute the realized PnL, determine WIN/LOSS status, update cumulative metrics, and generate a WhatsApp result notification.

### FR-374-06: Autonomous Executive Session Summary

- **Pattern**: Event-Driven
- **Requirement**: WHEN an operational trading session concludes or reaches daily target, THE SYSTEM SHALL generate an executive WhatsApp daily summary containing total trades, win rate, net PnL, drawdown status, and prop-firm challenge status.

### FR-374-07: Invariant Auditing & Cryptographic Receipt Generation

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM SHALL generate a signed cryptographic SHA-256 execution receipt (`TRI_TEMPORAL_PROP_FIRM_RECEIPT.json`) verifying formal invariants (`TriTemporalHarmonicAlignment`, `PropFirmSurvivalInvariant`, `PracticeModeIsolation`, `SingleExecutionLock`).

---

## 2. Acceptance Criteria (BDD)

### BDD-2026: Tri-Temporal Harmonic Alignment Validates 3 Timeframes

- **GIVEN** M15 Bullish trend, M5 Bullish Fibonacci pullback, and M1 Bullish BinaryTeach rejection wick,
- **WHEN** fractal alignment is evaluated,
- **THEN** it produces status `HARMONIC_ALIGNED_CALL` with confidence $\ge 0.85$.

### BDD-2027: Conflicting Timeframe Blocks Execution Fail-Closed

- **GIVEN** M15 Bearish trend and M1 Bullish micro-wick,
- **WHEN** fractal alignment is evaluated,
- **THEN** it rejects the trade with status `TIMEFRAME_CONFLICT_REJECTED` and zero orders are placed.

### BDD-2028: Daily Drawdown Guard Enforces Hard Stop at -4.5%

- **GIVEN** an active simulated prop-firm account,
- **WHEN** daily losses reach -4.5%,
- **THEN** the engine transitions to state `HALTED_PROP_FIRM_DAILY_LIMIT` and rejects subsequent trades.

### BDD-2029: Cumulative Total Drawdown Enforces Hard Stop at -9.0%

- **GIVEN** an active simulated prop-firm account,
- **WHEN** cumulative peak-to-trough drawdown reaches -9.0%,
- **THEN** the engine transitions to state `HALTED_PROP_FIRM_TOTAL_LIMIT` and preserves account survival.

### BDD-2030: WhatsApp Trade Open Alert Payload Generation

- **GIVEN** an executed autonomous trade,
- **WHEN** the notification dispatcher formats the trade alert,
- **THEN** it produces a markdown-formatted string with WhatsApp bold markers (`*`), emojis, asset, direction, score, and fractal breakdown.

### BDD-2031: WhatsApp Outcome Alert & Daily Summary Generation

- **GIVEN** a concluded trading session with 5 trades (4 wins, 1 loss),
- **WHEN** the daily summary generator is invoked,
- **THEN** it produces an executive summary reporting 80.0% win rate, net PnL, and current prop-firm progress.

### BDD-2032: Invariant Audit and Receipt Generation

- **GIVEN** a Tri-Temporal Prop-Firm Engine instance,
- **WHEN** the audit method is executed,
- **THEN** it validates all 4 formal invariants and writes `TRI_TEMPORAL_PROP_FIRM_RECEIPT.json` with a valid 64-character SHA-256 hash.
