# PLAN-233: Sovereign Institutional Quantitative Trading Engine & Byzantine Consensus Crucible

**Component:** `eos-system-control-plane` (Glorian System)  
**Spec Reference:** `SPEC-371` | **Change Reference:** `CHANGE-233`  
**Author:** Valentín Flórez Arbeláez / Antigravity AI  
**Date:** 2026-11-19T19:56:00-05:00

---

## 1. Architectural Overview & Clean Hexagonal Isolation

The Quantitative Trading Engine is structured as a pure Layer-0 subsystem inside Glorian System:

- **Domain Core (`src/core/eosInstitutionalTradingEngine.ts`):** 100% pure TypeScript. Contains mathematical functions, multi-strategy evaluators, the Byzantine Consensus Council, and risk state transitions. Zero external imports.
- **Port / Interface Layer (`src/core/eosInstitutionalTradingEngine.types.ts`):** Defines typed interfaces for OHLC candles, strategy signals, judge ballots, consensus receipts, and session risk states.
- **Adapter / CLI Layer (`bin/commands/cliTradingEngine.mjs`):** Integrates with IQ Option MCP endpoints via HTTP/SSE or Node fetch, formats terminal tables, and handles `trading:scan`, `trading:status`, `trading:confluence`, and `trading:audit`.
- **Telemetry Adapter:** Writes local bitácora entries into `data/bitacora_trading.csv` and state into `.eos/trading-state.json`.

---

## 2. Architecture Decision Record (ADR-233-001)

### Context

Algorithmic trading on digital and binary options requires sub-millisecond mathematical indicator computation, strict concurrency control, and zero-compromise risk governance. Offloading price calculations or trade authorization to an LLM introduces latency, arithmetic errors, and catastrophic halluncinations.

### Decision

1. Implement pure arithmetic indicators (EMA, RSI, Bollinger, ADX, Stochastic, Z-Score) in zero-dependency ESM modules.
2. Structure the trade signal generator as a 4-Judge Byzantine Council:
   - `TrendJudge`: Structure & momentum.
   - `LiquidityJudge`: S/R sweeps & wick absorption.
   - `MomentumJudge`: Oscillators & divergence.
   - `RiskGovernor`: Absolute veto power over drawdown, account mode, stake size, cooldown, and OTC restrictions.
3. Model the consensus protocol formally using Leslie Lamport's TLA+.

### Rejected Alternatives

- _LLM in the real-time loop:_ Rejected due to 1-4 second latency and arithmetic unreliability.
- _Martingale recovery logic:_ Rejected due to mathematical certainty of ruin.
- _Third-party technical analysis libraries (technicalindicators, ta-lib):_ Rejected to maintain Layer-0 dependency-free architecture (`dependencies: {}`).

---

## 3. Invariants & Security

- Practice account (`training`) strictly enforced until 100 audited trades pass.
- Concurrency bounded at exactly 1 open position.
- No plain credentials or trading data committed to Git.
