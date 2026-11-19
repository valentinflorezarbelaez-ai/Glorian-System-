# CHANGE-228: SWE-Bench Autonomous Evaluation Harness & Fleet Eval Flywheel

**Change Identifier**: `CHANGE-228`  
**Specification Target**: `SPEC-366`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `PROPOSED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Description & Context

This change introduces `EosSweBenchEvalFlywheel`, a comprehensive autonomous agent evaluation harness and continuous benchmark flywheel. It enables automated execution of SWE-bench style software engineering challenges, mines synthetic real-world benchmarks from historical git PRs across the 9 registered fleet repositories, calculates deterministic `pass@k` capabilities, and provides quantitative proof of agentic code resolution power.

---

## 2. Delta Specification Summary

### Added Modules

- `docs/formal/SweBenchEvalFlywheel.tla`: Leslie Lamport TLA+ Model 109 modeling evaluation task ingestion, sandbox execution, test oracle grading, and pass@k scorecard convergence.
- `docs/formal/SweBenchEvalFlywheel.cfg`: TLC model configuration for Model 109.
- `src/core/eosSweBenchEvalFlywheel.types.ts`: TypeScript interfaces for eval challenges, test oracles, benchmark scorecards, synthetic challenge specs, and receipts ($\le 800$ lines).
- `src/core/eosSweBenchEvalFlywheel.ts`: Pure Layer-0 evaluation harness, git PR mining engine, and statistical pass@k calculator ($\le 800$ lines).
- `bin/commands/cliSweBenchEvalFlywheel.mjs`: CLI router supporting `toolchain:eval:run`, `toolchain:eval:synthetic`, `toolchain:eval:matrix`, and `toolchain:eval:audit`.
- `test/eosSweBenchEvalFlywheel.test.mjs`: Automated BDD test suite verifying `BDD-1975` through `BDD-1980`.

### Modified Modules

- `scripts/run-tlc.mjs`: Register `"SweBenchEvalFlywheel"` in `CONFIGURED_SPECS`.
- `src/core/index.ts`: Export `EosSweBenchEvalFlywheel` and associated types.
- `bin/commands/cliToolchainRouter.mjs`: Route `toolchain:eval:*` commands.
- `bin/commands/cliHelpCatalog.mjs`: Document new CLI commands.
- `src/core/eosMcpToolTaxonomy.ts`: Register `eos_swe_bench_eval_flywheel_audit`.
- `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`: Define MCP schema.
- `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`: Implement MCP execution handler.
- `docs/contracts/mcp-tool-catalog.json`: Update MCP catalog.
- `IMPLEMENTATION_AUTHORIZATION.md`: Record `AUTH-2026-11-19-SWE-BENCH-EVALS-FLYWHEEL`.

---

## 3. Backward Compatibility & Purity

- **Zero Runtime Dependencies**: Strict Layer-0 adherence using Node.js built-ins (`node:crypto`, `node:fs`, `node:path`).
- **Clean Invariants**: Max lines $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
