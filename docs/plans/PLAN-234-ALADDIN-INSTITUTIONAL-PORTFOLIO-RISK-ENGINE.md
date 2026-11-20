# PLAN-234: Aladdin Institutional Portfolio & Multi-Factor Risk Engine

- **Plan ID**: PLAN-234
- **Related Spec**: SPEC-372
- **Change Ref**: CHANGE-234
- **Author**: Valentin Florez & Antigravity
- **Date**: 2026-11-19
- **Status**: APPROVED

---

## 1. Architectural Overview (Clean & Hexagonal)

```text
               +-------------------------------------------+
               |             CLI Subsystem                 |
               | (toolchain:aladdin:stress-test / var / ..)|
               +---------------------+---------------------+
                                     |
                                     v
               +-------------------------------------------+
               |        EosAladdinPortfolioRiskEngine       |
               |                 (Domain Core)             |
               +---------------------+---------------------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +-------------------+       +-------------------+
|  Dual-Vault Core |       | Monte Carlo & VaR |       | Stress & Parity   |
| (Alpha/Beta Box) |       | (Box-Muller PRNG) |       | (All-Weather)     |
+------------------+       +-------------------+       +-------------------+
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-234-001: Deterministic Seeded PRNG via Box-Muller Transformation

- **Context**: Monte Carlo simulations require generating normally distributed random variables ($Z \sim \mathcal{N}(0, 1)$). External libraries like `mathjs` or `random-js` violate our `dependencies: {}` zero-runtime-dependency constraint.
- **Decision**: Implement a pure TypeScript XorShift128+ pseudo-random generator with Box-Muller transformation:
  $$Z_0 = \sqrt{-2 \ln U_1} \cos(2\pi U_2)$$
  $$Z_1 = \sqrt{-2 \ln U_1} \sin(2\pi U_2)$$
- **Consequences**: Deterministic, reproducible simulations across CI/CD and platforms without floating-point drift or external libraries.

### ADR-234-002: Dual-Vault Fiduciary Barrier

- **Context**: The user manages family capital ($3,000 USD). Inadvertent execution of high-frequency or unhedged contracts would risk family well-being.
- **Decision**: Hardcode a state-machine level boundary separating `VAULT_ALPHA_FIDUCIARY` from `VAULT_BETA_QUANT_LAB`. Vault Alpha only permits `CAPITAL_PRESERVATION` asset classes (Sovereign bonds, AAA CDTs, Global Index ETFs) with zero ruin allowance ($P_{\text{ruin}} \equiv 0$).
- **Consequences**: Fail-closed protection of family funds.
