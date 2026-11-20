# INTAKE-236: Sovereign Autonomous Prop-Firm Trader, Tri-Temporal Fractal Engine & Real-Time WhatsApp Dispatcher

- **Intake ID**: INTAKE-236
- **Project**: `eos-system` (`Glorian System Control Plane`)
- **Originator**: Valentin Florez (Principal Architect & System Owner)
- **Target Specification**: SPEC-374
- **Change Proposal**: CHANGE-236
- **Date**: 2026-11-19
- **Status**: INTAKE_COMPLETE

---

## 1. Context and Problem Statement

To achieve complete autonomous operations and institutional-grade trading execution, the user requested three high-impact capabilities:

1. **Tri-Temporal Fractal Alignment Engine (M15 $\rightarrow$ M5 $\rightarrow$ M1)**:
   - High-probability trading requires harmonic synchronization across three fractal timeframes:
     - **M15 (Macro Compass)**: Establishes the institutional trend bias and major support/resistance zones.
     - **M5 (Structural Flow)**: Identifies the Fibonacci retracement wave (61.8% - 78.6% Golden Pocket) and intermediate structure.
     - **M1 (Micro Execution Trigger)**: Pinpoints BinaryTeach candle-by-candle confirmation (rejection wicks $\ge 50\%$, exhaustion, or force momentum breakouts).
   - Invariant: A trade is strictly rejected if any of the three timeframes conflicts with the trade direction.

2. **Prop-Firm Challenge & FTMO Capital Protection Governor**:
   - The user seeks capital growth without risking family funds. Proprietary trading firms (FTMO, FundedNext, Apex Trader Funding) provide $50,000 to $200,000 USD of firm capital to traders who demonstrate statistical discipline.
   - The engine must strictly enforce institutional prop-firm risk boundaries:
     - Maximum Daily Drawdown: 4.5% hard stop (safely below FTMO's 5.0% failure threshold).
     - Maximum Total Drawdown: 9.0% hard stop (safely below FTMO's 10.0% failure threshold).
     - Profit Target: +10.0% (evaluates challenge completion).

3. **Autonomous Trading Loop & Real-Time WhatsApp Dispatcher**:
   - The user desires an autonomous background engine that scans, analyzes, and executes trades without requiring human chart-staring, while streaming formatted WhatsApp/webhook alerts detailing every action:
     - Real-time trade opening alerts (pair, direction, entry price, strike time, confluence score, and 3-timeframe breakdown).
     - Trade outcome alerts (WIN/LOSS, net PnL, win rate, daily target progress).
     - Daily comprehensive executive summary reports.
   - Operates strictly in Practice (Demo) mode fail-closed to protect all family capital.

---

## 2. Inviolable Governance Constraints

1. **Zero Runtime Dependencies**: Strict adherence to `package.json` with `dependencies: {}`.
2. **Line Ceiling**: All modules must maintain $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
3. **Formal Verification**: Full TLA+ specification model checked via TLC.
4. **Fiduciary Vault Isolation**: Real capital ($3,000 USD) remains 100% locked and untouchable. Execution occurs strictly in Demo sandbox.
