# CHANGE-226: Fleet Chaos Monkey & Autonomous FDIR Engine

**Change Identifier**: `CHANGE-226`  
**Specification Target**: `SPEC-364`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `PROPOSED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Description & Context

This change introduces `EosFleetChaosMonkey`, a controlled fault-injection and autonomous FDIR (Failure Detection, Isolation & Recovery) engine. It continuously perturbs the 9 registered fleet repositories across 6 orthogonal failure modes (`CORRUPTED_AST`, `BROKEN_MERKLE_ROOT`, `SPLIT_BRAIN_RAFT_PARTITION`, `BUFFER_SATURATION_SPIKE`, `DRIFTED_OPENSPEC`, and `LATENCY_INJECTION`), rigorously measuring and certifying that Mean Time To Recovery (MTTR) remains strictly below 500 milliseconds.

---

## 2. Delta Specification Summary

### Added Modules

- `docs/formal/FleetChaosFdirEngine.tla`: Leslie Lamport TLA+ Model 107 modeling fault injection, anomaly isolation, Raft-leased healing, and bounded MTTR convergence invariants.
- `docs/formal/FleetChaosFdirEngine.cfg`: TLC model configuration for Model 107.
- `src/core/eosFleetChaosMonkey.types.ts`: TypeScript interfaces for chaos vectors, fault injections, FDIR receipts, and MTTR benchmarks.
- `src/core/eosFleetChaosMonkey.ts`: Pure Layer-0 chaos monkey and FDIR engine with sub-millisecond recovery loops across all 9 fleet repositories.
- `bin/commands/cliFleetChaosMonkey.mjs`: CLI router supporting `toolchain:chaos:inject`, `toolchain:chaos:fdir`, `toolchain:chaos:fleet`, and `toolchain:chaos:audit`.
- `test/eosFleetChaosMonkey.test.mjs`: Automated BDD test suite verifying `BDD-1963` through `BDD-1968`.

### Modified Modules

- `scripts/run-tlc.mjs`: Registered `"FleetChaosFdirEngine"` in `CONFIGURED_SPECS`.
- `src/core/index.ts`: Exported `EosFleetChaosMonkey` and associated types.
- `bin/commands/cliToolchainRouter.mjs`: Routed `toolchain:chaos:*` commands.
- `bin/commands/cliHelpCatalog.mjs`: Documented new CLI commands.
- `src/core/eosMcpToolTaxonomy.ts`: Registered `eos_fleet_chaos_monkey_audit`.
- `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`: Defined MCP schema.
- `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`: Implemented MCP execution handler.
- `docs/contracts/mcp-tool-catalog.json`: Updated MCP catalog.
- `IMPLEMENTATION_AUTHORIZATION.md`: Recorded `AUTH-2026-11-19-FLEET-CHAOS-FDIR`.

---

## 3. Backward Compatibility & Purity

- **Zero Runtime Dependencies**: Strict adherence to Node.js built-ins (`node:crypto`, `node:fs`, `node:path`).
- **Clean Invariants**: Max lines $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
