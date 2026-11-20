# INTAKE-233: Sovereign Institutional Quantitative Trading Engine & Byzantine Consensus Crucible

**Component:** `eos-system-control-plane` (Glorian System)  
**Author:** Valentín Flórez Arbeláez / Antigravity AI  
**Date:** 2026-11-19T19:56:00-05:00  
**Target Spec:** `SPEC-371` | **Target Change:** `CHANGE-233` | **Lifecycle:** Production Ready

---

## 1. Executive Summary & Context

Valentín requires a sovereign, elite-tier institutional quantitative trading engine within Glorian System that synthesizes the most advanced trading strategies in the world (Renaissance Technologies statistical arbitrage, ICT/SMC institutional order flow and liquidity sweeps, Wyckoff volume confirmation, and Nexus / Juan Facundo / Diego Facundo risk parameters).

The system must operate under absolute mathematical determinism (zero LLM hallucination of prices or indicators), execute strictly in `PRACTICE` (Demo) account mode until 100 trades pass audit, enforce 1-operation-at-a-time concurrency lock, zero Martingale, flat 1.0%-2.0% sizing, strict daily stop-loss (-3%), daily take-profit (+3.4% to +5%), trailing profit lock, and evaluate all trade setups through a Byzantine Multi-Agent Consensus Council before emitting signals.

## 2. Business & Engineering Goals

1. **Multi-Strategy Confluence:** Implement 4 distinct institutional strategies:
   - Strategy 1: _Liquidity Sweep & Order Flow Reversal_ (ICT / Wyckoff).
   - Strategy 2: _Institutional Trend Pullback_ (SMC / Nexus EMA 9-20-50).
   - Strategy 3: _TTM Volatility Squeeze & Velocity Breakout_.
   - Strategy 4: _Mean-Reversion Quant Oscillator Confluence_ (Z-Score + BB 20/2.2 + RSI 14 + Stochastic).
2. **Byzantine Consensus Council:** A 4-Judge council (`TrendJudge`, `LiquidityJudge`, `MomentumJudge`, `RiskGovernor`) where at least 3 strategy judges must agree and `RiskGovernor` must provide unanimous approval for safety.
3. **Layer-0 Architectural Purity:** Zero runtime npm dependencies (`dependencies: {}`), strict `< 800` lines per module with $\ge 12$ lines headroom, 100% TypeScript type safety.
4. **Deterministic Telemetry & Bitácora:** Local persistence of trades into `data/bitacora_trading.csv` and state into `.eos/trading-state.json`, completely protected by `.gitignore`.
5. **CLI Parity & MCP Omni-Tools:** Native CLI command suite (`trading:scan`, `trading:status`, `trading:confluence`, `trading:audit`) and native MCP tool `eos_institutional_trading_audit`.
