# PLAN-237: Universal Multi-Asset Universe & Dynamic Payout Optimizer Architecture

**Spec Target:** SPEC-375 / CHANGE-237  
**Module:** `EosUniversalAssetPayoutOptimizerEngine`  
**Location:** `src/core/eosUniversalAssetPayoutOptimizerEngine.ts` & `.types.ts`

---

## 1. Architectural Decisions (ADRs)

### ADR-237-001: Dynamic Mode Synthesis vs Fixed Asset Tables

- **Context:** Binary and Digital options on IQ Option feature variable payout percentages depending on session volume and broker risk book.
- **Decision:** Implement a dynamic payout evaluation function where incoming quotes declare current yields for both instrument types. The engine calculates expected value and dynamically routes order parameters.
- **Rejected Alternative:** Hardcoding static payouts or restricting trading to only binary options, which leaves significant margin on the table when digital options yield 90-95%.

### ADR-237-002: Modular Multi-Class Catalog with Granular Precision Tolerances

- **Context:** Forex pairs typically quote to 4 or 5 decimal places, commodities to 2 or 3, crypto to 2 or 6 (for PEPE), and equities to 2.
- **Decision:** Parameterize the round-number detection using normalized basis points ($0.03\%$ relative distance threshold) rather than raw absolute price units.
- **Consequence:** Uniform, scale-invariant detection across high-price assets (BTC at $90,000, Gold at $2,650), medium-price assets (AAPL at $230), and low-price/fractional assets (EUR/USD at 1.0850, PEPE).

---

## 2. Component Structure

```text
src/core/
  ├── eosUniversalAssetPayoutOptimizerEngine.types.ts (Data models, asset classes, receipts)
  └── eosUniversalAssetPayoutOptimizerEngine.ts       (Layer-0 pure logic, ranking, key-level detection)
bin/commands/
  └── cliUniversalAssetPayoutEngine.mjs               (CLI subcommands for scanning and payout inspection)
docs/formal/
  ├── UniversalAssetPayoutOptimizer.tla               (TLA+ Model 118 specification)
  └── UniversalAssetPayoutOptimizer.cfg               (TLA+ configuration)
test/
  └── eosUniversalAssetPayoutOptimizerEngine.test.mjs (BDD-2033..BDD-2040 tests)
```
