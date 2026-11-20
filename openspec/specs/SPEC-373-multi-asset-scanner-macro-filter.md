# SPEC-373: Autonomous Multi-Asset Scanner, Macro Economic News Filter & Paper-Trading Ledger

- **Specification ID**: SPEC-373
- **Change Reference**: CHANGE-235
- **Intake Reference**: INTAKE-235
- **Domain**: Quantitative Multi-Asset Analysis, Economic News Blackout & Paper Execution
- **Status**: FORMALIZED
- **Version**: 1.0.0

---

## 1. Functional Requirements (IEEE 830 EARS)

### FR-373-01: Concurrent Multi-Asset Scanning & Ranking

- **Pattern**: Event-Driven
- **Requirement**: WHEN a multi-asset market scan is triggered, THE SYSTEM SHALL concurrently analyze 6 major asset pairs (`EUR/USD`, `GBP/USD`, `USD/JPY`, `AUD/USD`, `USD/CAD`, `EUR/JPY`), evaluate Byzantine council voting scores for each, and rank them in descending order of confluence score.

### FR-373-02: Macroeconomic High-Impact News Blackout Window

- **Pattern**: State-Driven
- **Requirement**: WHILE the current timestamp falls within the defined blackout buffer (default: 30 minutes before to 30 minutes after any scheduled high-impact economic event), THE SYSTEM SHALL enforce state `NEWS_BLACKOUT_ACTIVE` and suppress all trading signals fail-closed.

### FR-373-03: Autonomous Paper-Trading Ledger Recording

- **Pattern**: Event-Driven
- **Requirement**: WHEN a valid multi-judge consensus trade is identified and no news blackout is active, THE SYSTEM SHALL record an immutable paper-trading entry into `docs/evidence/PAPER_TRADING_LEDGER.json` with entry price, direction, timestamp, council voting breakdown, and simulated payout.

### FR-373-04: High-Impact Economic Calendar Registry

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM SHALL maintain a structured catalog of high-impact macroeconomic event patterns (FOMC, NFP, CPI, Central Bank Rate Decisions) with severity classification (`HIGH_RED_FOLDER`, `MEDIUM_ORANGE`, `LOW_YELLOW`).

### FR-373-05: Single Best Asset Election

- **Pattern**: State-Driven
- **Requirement**: WHILE multiple assets qualify with consensus $\ge 75\%$, THE SYSTEM SHALL elect strictly the single highest-scoring asset to prevent correlated overexposure across currency pairs sharing the same base or quote currency.

### FR-373-06: Paper Trading Performance Analytics

- **Pattern**: Event-Driven
- **Requirement**: WHEN paper ledger analytics are queried, THE SYSTEM SHALL compute total simulated trades, win rate percentage, profit factor, maximum paper drawdown, and average trade return.

### FR-373-07: Invariant Auditing & Cryptographic Receipt Generation

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM SHALL generate a signed cryptographic SHA-256 execution receipt (`MULTI_ASSET_MACRO_RECEIPT.json`) verifying formal invariants (`NewsBlackoutStrictness`, `SingleAssetExecutionElection`, `PaperModeIsolation`, `DeterministicRankingOrder`).

---

## 2. Acceptance Criteria (BDD)

### BDD-2019: Multi-Asset Scanner Evaluates 6 Pairs and Ranks by Confluence

- **GIVEN** candle data for 6 major pairs,
- **WHEN** multi-asset scanning is executed,
- **THEN** it produces an evaluated score and council verdict for each pair and ranks the best setup at index 0.

### BDD-2020: High-Impact News Event Triggers Automatic Trading Blackout

- **GIVEN** a scheduled red-folder event (e.g. US Non-Farm Payrolls),
- **WHEN** the engine assesses trade viability within the 30-minute blackout window,
- **THEN** it rejects trade execution with reason `NEWS_BLACKOUT_ACTIVE` and preserves state.

### BDD-2021: Non-Blackout Window Resumes Scanning Normally

- **GIVEN** the current time is 45 minutes past a high-impact news event,
- **WHEN** the news filter evaluates the calendar,
- **THEN** it returns `NEWS_BLACKOUT_CLEAN` and permits council signal generation.

### BDD-2022: Correlated Currency Overexposure Guard Elects Only Best Asset

- **GIVEN** two qualifying assets both sharing USD (e.g., EUR/USD with score 0.88 and GBP/USD with score 0.82),
- **WHEN** the allocator selects execution targets,
- **THEN** it selects strictly EUR/USD and suppresses GBP/USD to eliminate double USD risk.

### BDD-2023: Autonomous Paper-Trading Ledger Ingestion

- **GIVEN** a simulated approved trade opportunity,
- **WHEN** paper trade recording is executed,
- **THEN** it appends an immutable paper datom containing trade ID, asset, timestamp, entry price, and direction.

### BDD-2024: Paper Ledger Performance Metrics Calculation

- **GIVEN** a history of paper trades with known outcomes,
- **WHEN** ledger performance is queried,
- **THEN** it calculates win rate, total net return, and profit factor correctly without division by zero.

### BDD-2025: Invariant Auditing and Cryptographic Receipt Generation

- **GIVEN** a Multi-Asset Macro Filter Engine instance,
- **WHEN** the audit method is executed,
- **THEN** it verifies all 4 invariants and writes `MULTI_ASSET_MACRO_RECEIPT.json` with a valid 64-character SHA-256 hash.
