# CHANGE-233: Institutional Quantitative Trading Engine & Byzantine Consensus Crucible

**Proposal Date:** 2026-11-19T19:56:00-05:00  
**Target Specification:** `SPEC-371`  
**Related Specs:** `SPEC-123`, `SPEC-124`, `SPEC-250`, `SPEC-270`  
**Status:** PROPOSED

---

## 1. Intent & Problem Statement

High-frequency and algorithmic trading on retail binary and digital options suffers from massive failure rates due to human emotional instability (revenge trading, Martingale position doubling, trading off-hours in low-liquidity OTC markets) and imprecise indicator calculation.

Glorian System requires an institutional-grade, zero-dependency quantitative subsystem that runs deterministic mathematical indicators, evaluates multi-strategy confluence (Liquidity Sweep, Trend Pullback, Volatility Squeeze, Quant Mean-Reversion), filters all signals through a 4-Judge Byzantine Consensus Council, and enforces strict risk controls: demo isolation, flat 1.0%-2.0% stakes, daily stop-loss (-3%), daily take-profit (+3.4% to +5%), trailing profit lock, and 1-operation-at-a-time concurrency.

## 2. Scope of Changes

- Formal Specification: `openspec/specs/SPEC-371-institutional-quantitative-trading-engine.md` (EARS + BDD).
- Architecture Plan & ADR: `docs/plans/PLAN-233-INSTITUTIONAL-QUANTITATIVE-TRADING-ENGINE.md` (`ADR-233-001`).
- Atomic Task DAG: `docs/tasks/TASKS-233-INSTITUTIONAL-QUANTITATIVE-TRADING-ENGINE.md`.
- Implementation Authorization: `IMPLEMENTATION_AUTHORIZATION.md`.
- Formal TLA+ Model: `docs/formal/InstitutionalTradingEngine.tla` and `.cfg`.
- Types & Core Implementation: `src/core/eosInstitutionalTradingEngine.types.ts` and `src/core/eosInstitutionalTradingEngine.ts`.
- Core Re-export: `src/core/index.ts`.
- CLI Handler: `bin/commands/cliTradingEngine.mjs`.
- CLI Routing & Help Catalog: `bin/commands/cliToolchainRouter.mjs` and `bin/commands/cliHelpCatalog.mjs`.
- MCP Tool: `eos_institutional_trading_audit` in `src/mcp/eosMcpServer.ts`.
- Automated Test Suite: `test/eosInstitutionalTradingEngine.test.mjs`.
- Release Documents & Pin: `EOS_FREEZE_GATE_STATUS.md` and `RELEASE_CAPABILITY_MATRIX.md`.

## 3. Invariants Preserved

- Zero external dependencies (`dependencies: {}` in package.json).
- Module size limit: $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
- 100% CLI and MCP tool parity.
- 100% test passing and Leslie Lamport TLA+ model checking verification.
