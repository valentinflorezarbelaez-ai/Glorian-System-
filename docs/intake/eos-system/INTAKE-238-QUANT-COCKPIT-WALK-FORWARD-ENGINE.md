# EOS INTAKE: QUANT COCKPIT, SECOND-59.8 ATOMIC TRIGGER & WALK-FORWARD ENGINE

**ID:** INTAKE-238  
**Spec Target:** SPEC-376 / CHANGE-238  
**Date:** 2026-11-20  
**Component:** `eos-system-control-plane` (Glorian System)  
**Requester:** Valentin Florez Arbelaez (Lead Architect & Capital Allocator)  
**Fiduciary Beneficiary:** Edison Alberto Florez Lopez (Vault Alpha Segregation: $3,000 USD)

---

## 1. Executive Summary & Intent

Following `SPEC-375`, the requester mandated integrating all remaining quantitative improvements (Improvements B, C, and D) while connecting the engine to **ALL open live assets on IQ Option (153+ instruments dynamically ingested)** and applying elite institutional 1-minute trader selectivity:

1. **Unbounded Dynamic IQ Option Universe Ingestion (`list_assets` + `get_candles`)**:
   - No hardcoded static ceiling of 6 or 32 pairs.
   - Dynamically ingests every instrument returned by the `iq-binary-options` MCP gateway (Forex majors/crosses, Commodities, Crypto majors & OTC memecoins, Mega-Cap Equities, Stock Indices & ETFs, and 24/7 OTC pairs) and normalizes IQ Option candle payloads (`open`, `max`, `min`, `close`, `from`, `to`).
2. **Institutional 6-Factor Expert Selector Funnel**:
   - Filters out any closed or low-payout (< 80%) instrument, volatility manipulation spikes (> 3.0x trailing 10-candle range), flat/dead markets, and choppy noise (`CHOPPY_NO_TRADE`).
   - Classifies market regime (`TRENDING_BULL`, `TRENDING_BEAR`, `RANGING`) and pairs the optimal strategy (`TREND_PULLBACK` M15->M5->M1 vs `RANGE_REVERSAL` Bollinger/RSI/Rejection-Wick).
   - Enforces strictly positive mathematical expectancy above break-even ($p_{\text{est}} \ge p_{\text{BE}} + 4.0\%$) and elects at most one Top-1 Sniper setup ($N_{\text{active}} \le 1$, $T_{\text{expiry}} = 60\text{s}$).
3. **Improvement B — Atomic Second-59.8 / 00 Candle-Transition Trigger**:
   - Arms order dispatch strictly within the candle boundary transition window (`secondsIntoMinute >= 59.5 || <= 0.3`) and aborts fail-closed when server clock drift exceeds `250 ms` or network latency exceeds `300 ms`.
4. **Improvement C — Walk-Forward Quarter-Kelly Calibrator & Alpha-Decay Quarantine**:
   - Computes rolling Win Rate, Profit Factor, Expectancy, COT (GMT-5) hourly performance, strategy buckets, and asset-class buckets from settled trade history.
   - Sizes flat stakes via fractional Quarter-Kelly clamped strictly to `[0.5%, 2.0%]` of the Demo (`training`) balance, enforcing strict **Zero Martingale** (`stakeAfterLoss <= previousStake`).
   - Automatically quarantines any strategy/hour/category bucket that falls below `52.0%` Win Rate after at least `20` settled trades.
5. **Improvement D — Live Antigravity Cockpit HUD & Dual-Vault Shield**:
   - Renders a consolidated quantitative terminal dashboard natively in Google Antigravity covering Demo (`training`, `$14,100.35 USD`) isolation vs locked real (`regular`) balances and `Vault Alpha` (`$3,000 USD`).
