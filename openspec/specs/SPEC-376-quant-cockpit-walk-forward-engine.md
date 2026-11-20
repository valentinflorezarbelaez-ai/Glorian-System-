# SPEC-376: Autonomous Quant Cockpit, Second-59.8 Trigger & Walk-Forward Calibrator Engine

**Status:** APPROVED  
**Version:** 1.0.0  
**Phase:** 8 (Layer-0 Pure Financial Architecture)  
**TLA+ Model:** Model 119 (`docs/formal/QuantCockpitWalkForwardEngine.tla`)  
**Merge Gate:** `npm run verify:strict`

---

## 1. Scope & Functional Requirements (EARS)

### FR-376-01: Unbounded Dynamic IQ Option Universe Ingestion & Normalization

- **WHEN** IQ Option gateway asset metadata (`list_assets`) and candle payloads (`get_candles`) are supplied, **THE SYSTEM** shall dynamically ingest and classify **all** available instruments without any static numerical ceiling across `FOREX`, `COMMODITIES`, `CRYPTO`, `EQUITIES`, `INDICES_ETFS`, and `OTC`, normalizing `{ open, max, min, close }` records into finite OHLC candles.

### FR-376-02: Expert 6-Factor Institutional Trader Funnel

- **WHEN** evaluating candidate assets for 60-second (`T_expiry = 60s`) Binary or Digital options, **THE SYSTEM** shall apply six deterministic gates in sequence:
  1. Tradability and payout floor (`isOpen === true` and `payoutPercent >= 80`).
  2. Volatility anomaly guard rejecting trailing manipulation spikes (`lastRange > 3.0 * avgLast10Range`) or dead flat candles (`avgLast10Range <= 0`).
  3. Market regime classification (`TRENDING_BULL`, `TRENDING_BEAR`, `RANGING`, `CHOPPY_NO_TRADE`).
  4. Strategy match pairing M15->M5->M1 `TREND_PULLBACK` for trending markets or Bollinger/RSI/rejection-wick `RANGE_REVERSAL` for ranging markets.
  5. Positive expected value margin above break-even ($p_{\text{BE}} = \frac{100}{100 + \text{Payout\%}}$, requiring $p_{\text{est}} \ge p_{\text{BE}} + 0.04$ and $\text{EV} > 0$).
  6. Top-1 Sniper election ranking qualified candidates by key-level weighted expected value while preserving `N_active <= 1`.

### FR-376-03: Atomic Second-59.8 / 00 Candle-Transition Trigger (Improvement B)

- **WHEN** an order entry timestamp and network diagnostics (`serverEpochMs`, `clockDriftMs`, `networkLatencyMs`) are evaluated, **THE SYSTEM** shall return `ARMED_FIRE` with `safeToExecute: true` if and only if `|clockDriftMs| <= 250`, `networkLatencyMs <= 300`, and corrected `secondsIntoMinute >= 59.5 || secondsIntoMinute <= 0.3`; otherwise **THE SYSTEM** shall fail closed with `ABORT_CLOCK_DRIFT`, `ABORT_HIGH_LATENCY`, `ABORT_LATE_ENTRY`, or `WAITING_BOUNDARY`.

### FR-376-04: Walk-Forward Quarter-Kelly Calibrator & Alpha-Decay Quarantine (Improvement C)

- **WHEN** closed historical trades are calibrated against a Demo (`training`) account balance, **THE SYSTEM** shall compute rolling Win Rate, Profit Factor, and Expectancy grouped by COT (GMT-5) hour, strategy, and asset category, clamp Quarter-Kelly position sizing ($f^* = 0.25 \cdot \frac{b p - (1 - p)}{b}$) to `[0.5%, 2.0%]`, enforce Zero Martingale (`lastTradeLost => recommendedKellyPercent <= previousStakePercent`), and mark any bucket with `>= 20` settled trades and Win Rate `< 52.0%` as `quarantined: true`.

### FR-376-05: Live Antigravity Cockpit HUD Rendering (Improvement D)

- **WHEN** building the Cockpit snapshot report, **THE SYSTEM** shall generate a structured `QuantCockpitReport` and human-readable `hudText` displaying Fiduciary Account Shield status, Atomic Trigger Clock (UTC & COT), Dynamic Universe breakdown, Macro News Blackout Radar, Top-1 Sniper verdict, and Walk-Forward Kelly calibration metrics inside Antigravity.

### FR-376-06: Dual-Vault Fiduciary & Read-Only Safety Shield

- **WHILE** any balance list or trade snapshot is evaluated, **THE SYSTEM** shall strictly forbid `regular` (real-money) balances from execution, operate exclusively against `training` (Demo) balances, and keep `Vault Alpha` (`$3,000 USD`) completely segregated (`P_ruin === 0`).

### FR-376-07: Non-Vacuous Invariant Audit & SHA-256 Receipt Generation

- **WHEN** `audit()` is invoked, **THE SYSTEM** shall execute live validation assertions across all six core invariants, generate a 64-character SHA-256 receipt, and persist `docs/evidence/QUANT_COCKPIT_WALK_FORWARD_RECEIPT.json`.

---

## 2. BDD Acceptance Criteria (BDD-2041..BDD-2048)

### BDD-2041: Unbounded IQ Option Multi-Class Ingestion (153+ Assets)

- **GIVEN** a full IQ Option gateway payload spanning all 6 categories (`FOREX`, `COMMODITIES`, `CRYPTO`, `EQUITIES`, `INDICES_ETFS`, `OTC`),
- **WHEN** `ingestIqOptionAssets()` is called with 153+ instruments,
- **THEN** all instruments are ingested and classified accurately with zero artificial truncation.

### BDD-2042: Expert 6-Factor Filter Rejects Manipulation Spikes & Negative Edge

- **GIVEN** candidate assets including a manipulation spike (`> 3x` range), choppy consolidation, and an open aligned setup with payout >= 88%,
- **WHEN** `evaluateExpertAsset()` processes each candidate,
- **THEN** spikes and chop are rejected fail-closed (`REJECTED_VOLATILITY_SPIKE`, `REJECTED_CHOPPY_NOISE`) and only positive-EV setups qualify.

### BDD-2043: Atomic Second-59.8 Trigger Gates Execute & Abort Deterministically

- **GIVEN** timestamps at `:59.800`, `:02.000`, `:30.000`, plus excessive latency (`350 ms`) and excessive drift (`300 ms`),
- **WHEN** `evaluateAtomicTrigger()` evaluates each condition,
- **THEN** only `:59.800` within bounds returns `ARMED_FIRE` (`safeToExecute: true`), while `:02.000`, `:30.000`, high latency, and clock drift return fail-closed non-fire decisions.

### BDD-2044: Quarter-Kelly Clamp & Zero-Martingale Enforcement After Loss

- **GIVEN** winning trade history plus a flag indicating `lastTradeLost: true` with `previousStakePercent: 1.0`,
- **WHEN** `calibrateWalkForward()` calculates the next stake,
- **THEN** `recommendedKellyPercent` remains within `[0.5, 2.0]`, never exceeds `previousStakePercent` after a loss, and sets `zeroMartingaleEnforced: true`.

### BDD-2045: Alpha-Decay Automatic Strategy Quarantine (< 52% Over >= 20 Trades)

- **GIVEN** 25 settled trades in a single strategy/category bucket achieving 40% Win Rate (`10 wins / 15 losses`),
- **WHEN** `calibrateWalkForward()` aggregates strategy statistics,
- **THEN** that strategy bucket is marked `quarantined: true` and surfaced in `quarantinedBuckets`.

### BDD-2046: Dual-Vault Shield Excludes Regular Real-Money Balances

- **GIVEN** IQ Option balances containing both `{ type: "regular", amount: 3707.8 }` and `{ type: "training", amount: 14100.35 }`,
- **WHEN** `buildCockpitReport()` initializes account governance,
- **THEN** only `training` (`$14,100.35`) is active for scanning, `regular` (`$3,707.80`) is locked (`regularBalanceLockedUsd > 0`), and `fiduciaryShieldIntact === true`.

### BDD-2047: Live Cockpit HUD Elects At Most Top-1 Sniper At 60s Expiry

- **GIVEN** multiple qualified setups across Forex, Gold, Crypto, Equities, and Indices,
- **WHEN** `buildCockpitReport()` renders the HUD with zero active open positions and clean macro blackout status,
- **THEN** at most one `TOP_SNIPER_A_PLUS` is elected with `expirySeconds === 60`, `N_active <= 1`, and complete Bloomberg-style `hudText`.

### BDD-2048: Cryptographic Audit Receipt & Phase-8 MCP Execution

- **GIVEN** `EosQuantCockpitWalkForwardEngine` and the Phase-8 MCP registry,
- **WHEN** `eos_quant_cockpit_walk_forward_audit` is invoked,
- **THEN** it returns `status: "VERIFIED"`, all 6 formal invariant flags `true`, a 64-char SHA-256 `receiptHash`, and writes `QUANT_COCKPIT_WALK_FORWARD_RECEIPT.json`.
