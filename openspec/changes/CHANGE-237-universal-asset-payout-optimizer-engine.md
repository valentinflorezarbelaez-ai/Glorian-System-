# CHANGE-237: Universal Multi-Asset Universe, Dynamic Payout Optimizer & 1-Minute Precision Engine

**Status:** PROPOSED  
**Spec Target:** SPEC-375  
**Domain:** Financial Engineering / Quantitative High-Frequency Options  
**Component:** `eos-system-control-plane` (Layer-0 Pure Core)  
**Parent Changes:** CHANGE-233 (SPEC-371), CHANGE-234 (SPEC-372), CHANGE-235 (SPEC-373), CHANGE-236 (SPEC-374)

---

## 1. Problem Statement

Traders operating in binary and digital options often limit themselves to a handful of currency pairs or trade assets with unfavorable payout percentages ($< 80\%$), degrading their expected mathematical return $E[R] = p \cdot \text{payout} - (1-p)$. Furthermore, high-probability micro-rejections on 1-minute candles frequently cluster around institutional round numbers (`.000` / `.500`) across Forex, commodities (Gold), cryptocurrencies (BTC, ETH, DASH, PEPE), and Big Tech equities (AAPL, MSFT). A unified engine is required to ingest this multi-class universe, discard suboptimal payouts, detect key-level confluence, and elect solely the single highest-probability trade.

---

## 2. Proposed Changes

1. **Multi-Class Asset Catalog**:
   - Define catalog schema covering Forex (majors, crosses, OTC), Commodities (Gold, Silver), Cryptocurrencies (BTC, ETH, DASH, SOL, XRP, PEPE), and Big Tech Equities (AAPL, MSFT, TSLA, NVDA, GOOGL, AMZN, META).
2. **Dynamic Payout Optimizer**:
   - Real-time comparison between Binary and Digital option yields.
   - Disqualification of any asset yielding $< 80\%$ payout.
   - Dynamic mode assignment (`DIGITAL` vs `BINARY`).
3. **Institutional Round-Number & Key-Level Detector**:
   - Arithmetic distance calculation to nearest major institutional round number (`.000`) and half-round number (`.500`).
   - Bonus confluence score when M1 BinaryTeach rejection wick touches an institutional level ($\le 3$ pips / $0.03\%$).
4. **Universal High-Pass Ranking & Top-1 Election**:
   - Evaluates all active assets through Tri-Temporal Fractal Alignment (M15 $\rightarrow$ M5 $\rightarrow$ M1) and the 4-Judge Byzantine Council.
   - Ranks qualified assets by composite confluence score $\times$ payout factor.
   - Elects only the single best asset for 60-second execution.
5. **Formal Verification (TLA+ Model 118)**:
   - Prove safety invariants: `PayoutAboveThreshold`, `SingleActiveTradeLock`, `VaultAlphaZeroRuin`, `StrictOneMinuteExpiry`.

---

## 3. Impact Analysis

- **Dependencies**: Zero external dependencies. Uses Node.js built-in crypto and math primitives.
- **Headroom**: All modules maintained $\le 800$ lines with $\ge 12$ lines headroom.
- **Merge Gate**: Verified via `npm run verify:strict` (7-stage SecDevOps gate).
