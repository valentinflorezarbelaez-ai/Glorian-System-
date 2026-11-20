# EOS INTAKE: UNIVERSAL ASSET UNIVERSE & DYNAMIC PAYOUT OPTIMIZER ENGINE

**ID:** INTAKE-237  
**Spec Target:** SPEC-375 / CHANGE-237  
**Date:** 2026-11-19  
**Component:** `eos-system-control-plane` (Glorian System)  
**Requester:** Valentín Flórez Arbeláez (Lead Architect & Capital Allocator)  
**Fiduciary Beneficiary:** Edison Alberto Flórez López (Father's Preserved Capital: $3,000 USD / ~12.5M COP)

---

## 1. Executive Summary & Intent

The user requests expanding the trading universe from a fixed set of 6 major currency pairs to the **complete asset universe** available in Binary and Digital Options on IQ Option at a strict **1-minute (60-second) expiration**:

1. **Multi-Class Asset Universe Coverage**:
   - **Forex Majors & Crosses**: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD, EUR/JPY, GBP/JPY (the Dragon), EUR/GBP, AUD/CAD, CAD/JPY, EUR/AUD.
   - **Commodities**: Gold (XAU/USD), Silver (XAG/USD), Crude Oil (WTI/Brent).
   - **Cryptocurrencies**: BTC/USD, ETH/USD, DASH/USD, SOL/USD, XRP/USD, DOGE/USD, PEPE/USD (and OTC crypto).
   - **Equities / Big Tech**: Apple (AAPL), Microsoft (MSFT), Tesla (TSLA), Amazon (AMZN), Google (GOOGL), Meta (META), Nvidia (NVDA).
   - **OTC (Over The Counter)**: 24/7 weekend and night availability (EUR/USD-OTC, GBP/USD-OTC, etc.).
2. **Dynamic Payout Optimizer (Binary vs Digital Selection)**:
   - Evaluates dynamic payout yields across Binary and Digital Options.
   - Selects the mode offering the superior expected return: $\max(\text{Payout}_{\text{Digital}}, \text{Payout}_{\text{Binary}})$.
   - Enforces a strict minimum profitability threshold ($\ge 80\%$, target $\ge 85\%$). Discards any asset paying below 80%.
3. **Institutional Round-Number / Psychological Level Detection**:
   - Identifies institutional key levels (`.000` triple-zero and `.500` mid-hundreds).
   - Correlates M1 BinaryTeach rejection wicks with key-level bounces for $\ge 90\%$ win-probability setups.
4. **Top-1 Execution Election & Concurrency Lock**:
   - Concurrently scans and ranks the entire asset universe.
   - Elects only the single best asset (Top 1) possessing the highest composite confluence score.
   - Strictly enforces the concurrency invariant ($N_{\text{active}} \le 1$).
5. **Absolute Fiduciary Protection**:
   - Vault Alpha ($3,000 USD) remains 100% segregated and untradeable ($P_{\text{ruin}} \equiv 0.00\%$).
   - Operations strictly executed in Practice Demo mode ($14,100.35 USD balance).
   - Centralized management directly in Google Antigravity console.
