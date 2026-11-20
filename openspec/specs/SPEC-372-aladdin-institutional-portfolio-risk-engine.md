# SPEC-372: Aladdin Institutional Portfolio & Multi-Factor Risk Engine

- **Specification ID**: SPEC-372
- **Change Reference**: CHANGE-234
- **Intake Reference**: INTAKE-234
- **Domain**: Institutional Wealth Engineering, Portfolio Risk Management & Fiduciary Stewardship
- **Status**: FORMALIZED
- **Version**: 1.0.0

---

## 1. Functional Requirements (IEEE 830 EARS)

### FR-372-01: Dual-Vault Fiduciary Isolation

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM SHALL maintain a strict cryptographic separation between `VAULT_ALPHA_FIDUCIARY` (family capital preservation) and `VAULT_BETA_QUANT_LAB` (sandbox algorithmic trading), guaranteeing that zero principal from Vault Alpha is exposed to speculative derivative contracts.

### FR-372-02: Multi-Factor Value-at-Risk (VaR) & Expected Shortfall (CVaR)

- **Pattern**: Event-Driven
- **Requirement**: WHEN a portfolio allocation or scenario analysis is evaluated, THE SYSTEM SHALL compute parametric and historical Value-at-Risk at 95% and 99% confidence intervals ($\text{VaR}_{95\%}$, $\text{VaR}_{99\%}$) alongside Conditional Value-at-Risk ($\text{CVaR}_{99\%}$).

### FR-372-03: Deterministic Monte Carlo Stochastic Simulation

- **Pattern**: Event-Driven
- **Requirement**: WHEN requested to project long-term survival, THE SYSTEM SHALL simulate 10,000 portfolio equity paths using Geometric Brownian Motion with a seeded deterministic PRNG (Box-Muller normal transform) and compute the exact Probability of Ruin ($P_{\text{ruin}}$) and maximum drawdown distribution.

### FR-372-04: Historical Black Swan Stress-Testing

- **Pattern**: Event-Driven
- **Requirement**: WHEN stress testing is executed, THE SYSTEM SHALL simulate portfolio shock responses across 4 canonical financial crises (2008 Lehman Liquidity Crunch, 2020 Covid Flash Crash, 1987 Black Monday, and 1970s Stagflation) and verify that portfolio capital remains above the catastrophic threshold.

### FR-372-05: Ray Dalio All-Weather Risk Parity Allocation

- **Pattern**: Event-Driven
- **Requirement**: WHEN requested to generate an institutional asset allocation, THE SYSTEM SHALL calculate target weights according to Ray Dalio's All-Weather Risk Parity framework (40% Long Treasuries, 30% Global Equities, 15% Intermediate Treasuries, 7.5% Gold, 7.5% Commodities) and detect rebalancing drift.

### FR-372-06: Fractional Kelly Capital Sizing Governor

- **Pattern**: State-Driven
- **Requirement**: WHILE evaluating capital allocation for any quantitative strategy, THE SYSTEM SHALL enforce fractional Kelly sizing bounded at a maximum of $\frac{1}{4}$ Kelly ($0.25 \times f^*$) to eliminate tail risk and gambler's ruin.

### FR-372-07: Invariant Auditing & Cryptographic Receipt Generation

- **Pattern**: Ubiquitous
- **Requirement**: THE SYSTEM SHALL generate a signed cryptographic SHA-256 execution receipt (`ALADDIN_PORTFOLIO_RISK_RECEIPT.json`) verifying all 4 formal invariants (`ZeroFiduciaryRuinInvariant`, `VaRThresholdBound`, `MaxDrawdownGuard`, and `DeterministicAllocationSum`).

---

## 2. Acceptance Criteria (BDD)

### BDD-2012: Dual-Vault Isolation Enforces Zero Fiduciary Ruin

- **GIVEN** Vault Alpha with principal $3,000 USD belonging to the fiduciary trust,
- **WHEN** an unhedged speculative derivative allocation is attempted on Vault Alpha,
- **THEN** the engine blocks the allocation fail-closed with status `FIDUCIARY_VIOLATION_BLOCKED` and zero capital is allocated.

### BDD-2013: Parametric and Historical VaR / CVaR Computation

- **GIVEN** an institutional multi-asset portfolio with defined returns and volatility,
- **WHEN** risk analysis is invoked,
- **THEN** the engine calculates $\text{VaR}_{95\%}$, $\text{VaR}_{99\%}$, and $\text{CVaR}_{99\%}$ bounded within mathematical limits ($\text{CVaR} \ge \text{VaR}$).

### BDD-2014: Monte Carlo 10,000-Path Stochastic Simulation

- **GIVEN** an asset portfolio configuration and annual expected drift $\mu$ and volatility $\sigma$,
- **WHEN** Monte Carlo simulation is run for 10,000 iterations over 252 trading days,
- **THEN** it produces a deterministic terminal wealth distribution, median terminal equity, and calculates $P_{\text{ruin}}$ with repeatable seeding.

### BDD-2015: Historical Crisis Stress-Testing Execution

- **GIVEN** the 4 historical crisis scenarios (2008, 2020, 1987, 1970s),
- **WHEN** the engine runs portfolio stress testing,
- **THEN** it outputs the simulated drawdown for each crisis and confirms the All-Weather portfolio out-survives a 100% equity allocation by at least 25 percentage points.

### BDD-2016: All-Weather Risk Parity Allocation & Drift Detection

- **GIVEN** an arbitrary initial asset weighting,
- **WHEN** the allocation generator is queried,
- **THEN** it returns exact All-Weather target weights summing to 100.0% and flags any asset exceeding $\pm 5.0\%$ rebalancing drift.

### BDD-2017: Fractional Kelly Guard Bounding

- **GIVEN** a quantitative strategy with win rate $p = 0.55$ and win/loss ratio $b = 1.0$,
- **WHEN** the position sizer evaluates allocation,
- **THEN** it calculates full Kelly $f^* = 0.10$ and clamps the operational allocation strictly to $\le 0.025$ ($2.5\%$).

### BDD-2018: Invariant Audit and Receipt Generation

- **GIVEN** an Aladdin risk engine instance,
- **WHEN** the audit method is executed,
- **THEN** it validates all 4 structural invariants and produces a verified cryptographic receipt with a non-empty SHA-256 hash.
