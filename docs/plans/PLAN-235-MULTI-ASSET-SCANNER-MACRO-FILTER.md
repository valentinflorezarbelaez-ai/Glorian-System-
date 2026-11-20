# PLAN-235: Autonomous Multi-Asset Scanner, Macro Economic News Filter & Paper-Trading Ledger

- **Plan ID**: PLAN-235
- **Related Spec**: SPEC-373
- **Change Ref**: CHANGE-235
- **Author**: Valentin Florez & Antigravity
- **Date**: 2026-11-19
- **Status**: APPROVED

---

## 1. Architectural Overview

```text
       +-------------------------------------------------------+
       |                  Multi-Asset Market Feed              |
       |  (EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, EUR/JPY)|
       +---------------------------+---------------------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |         EosMultiAssetMacroFilterEngine (Core)         |
       +---------------------------+---------------------------+
                                   |
                 +-----------------+-----------------+
                 |                                   |
                 v                                   v
   +-----------------------------+     +-----------------------------+
   |   Macro Economic News Guard |     |   Single-Asset Arbitrator   |
   |   (Red-Folder Blackout Win) |     |  (Currency Correlation Lock)|
   +-----------------------------+     +-----------------------------+
                 |                                   |
                 +-----------------+-----------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |           Autonomous Paper-Trading Ledger             |
       |         (docs/evidence/PAPER_TRADING_LEDGER.json)     |
       +-------------------------------------------------------+
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-235-001: Offline Economic Calendar Pattern Matching

- **Context**: Relying on external live HTTP news scraping in real-time introduces network latency, rate limits, and fragile third-party HTML parsing.
- **Decision**: Define a structured local calendar schema with timestamp matching and fuzzy pattern matching for standard economic indicators (FOMC, NFP, CPI, Rates). Support injecting synthetic or synchronized calendar feeds.
- **Consequences**: Deterministic, zero-dependency, testable, and resilient offline execution.

### ADR-235-002: Single-Asset Currency Correlation Arbitrator

- **Context**: Trading EUR/USD CALL and GBP/USD CALL simultaneously creates a doubled short-dollar risk.
- **Decision**: When multiple currency pairs generate a PASS verdict, the engine ranks them by Byzantine score and elects only the single highest-scoring pair, rejecting correlated duplicates.
- **Consequences**: Prevents unmanaged portfolio concentration.
