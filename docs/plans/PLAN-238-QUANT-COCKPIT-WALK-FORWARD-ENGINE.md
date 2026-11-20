# PLAN-238: Quant Cockpit, Second-59.8 Trigger & Walk-Forward Calibrator

**Spec Target:** SPEC-376 / CHANGE-238  
**Module:** `EosQuantCockpitWalkForwardEngine`  
**Locations:** `src/core/eosQuantCockpitWalkForwardEngine.ts`, `src/core/eosTradingSuiteBarrel.ts`

---

## 1. Architectural Decision Records (ADRs)

### ADR-238-001: Unbounded Dynamic IQ Option MCP Ingestion vs Static Catalogs

- **Context:** Hardcoding 28–32 symbols leaves 120+ live high-payout IQ Option instruments (S&P 500, US 100, EUR/CAD, AUD/JPY, AMD, Shiba, Gold Miners ETF, etc.) unmonitored.
- **Decision:** Accept arbitrary `IqOptionRawAsset[]` lists and `{ open, max, min, close }` candles directly from IQ Option MCP payloads, normalizing and classifying every open asset dynamically into 6 asset classes.
- **Rejected Alternative:** Extending static arrays manually on every broker listing change, which causes immediate catalog drift.

### ADR-238-002: Quarter-Kelly Clamped Sizing & Alpha-Decay Quarantine vs Full Kelly / Martingale

- **Context:** Full Kelly exhibits unacceptable variance in fixed-payout 60s binary/digital options, and Martingale guarantees eventual account ruin under consecutive losses.
- **Decision:** Implement Fractional Quarter-Kelly ($0.25 \cdot f^*$) strictly clamped to `[0.5%, 2.0%]` of the Demo balance, enforce `stakeAfterLoss <= previousStake`, and quarantine buckets dropping below `52.0%` WR over `>= 20` trades.
- **Rejected Alternative:** Unbounded Kelly or loss-doubling recovery ladders.

### ADR-238-003: Atomic Second-59.8 Boundary Window & Consolidated Trading Barrel

- **Context:** Entering M1 options mid-candle or with high latency distorts payout strike geometry; additionally, `src/core/index.ts` and `bin/commands/cliHelpCatalog.mjs` hit 788 lines (`SPEC-250` minimum headroom floor = 12).
- **Decision:** Enforce deterministic `secondsIntoMinute >= 59.5 || <= 0.3` and `networkLatencyMs <= 300` fail-closed checks; extract trading re-exports (`SPEC-371..SPEC-376`) into `src/core/eosTradingSuiteBarrel.ts` and group trading command lines concisely in `bin/commands/cliHelpCatalog.mjs` while keeping 100% token parity.
- **Rejected Alternative:** Raising global 800-line ceilings or polling blindly without latency guards.
