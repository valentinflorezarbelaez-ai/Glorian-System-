# INTAKE-235: Autonomous Multi-Asset Scanner, Macro Economic News Filter & Paper-Trading Ledger

- **Intake ID**: INTAKE-235
- **Project**: `eos-system` (`Glorian System Control Plane`)
- **Originator**: Valentin Florez (Principal Architect & System Owner)
- **Target Specification**: SPEC-373
- **Change Proposal**: CHANGE-235
- **Date**: 2026-11-19
- **Status**: INTAKE_COMPLETE

---

## 1. Context and Problem Statement

To achieve institutional-grade trading execution during live sessions (specifically the London/New York Prime Session between 7:00 AM and 10:30 AM Colombia time, GMT-5), the quantitative trading engine requires three mission-critical capabilities:

1. **Multi-Asset Concurrent Scanner**: Institutional desks evaluate multiple major currency pairs simultaneously (`EUR/USD`, `GBP/USD`, `USD/JPY`, `AUD/USD`, `USD/CAD`, `EUR/JPY`) to select only the single cleanest technical setup with the highest Byzantine consensus score across the fleet.
2. **Macroeconomic News Blackout Filter (Red-Folder Guard)**: High-impact economic news releases (US Non-Farm Payrolls [NFP], Consumer Price Index [CPI], FOMC Interest Rate Decisions, Central Bank Speeches) introduce erratic volatility, widen broker spreads, and generate false technical breakouts. Professional traders enforce a strict blackout window (15–30 minutes pre- and post-announcement).
3. **Autonomous Paper-Trading Ledger**: Records every detected confluence into a persistent local ledger with entry price, strike, expiration, council voting breakdown, and simulated payout without exposing any capital to market risk.

---

## 2. Inviolable Governance Constraints

1. **Zero Runtime Dependencies**: Strict adherence to `package.json` with `dependencies: {}`.
2. **Line Ceiling**: All modules must maintain $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
3. **Formal Verification**: Full TLA+ specification model checked via TLC.
4. **Practice Mode Isolation**: Live paper trading operates strictly on training/demo data with zero access to real account funds.
