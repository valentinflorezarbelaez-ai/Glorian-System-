# TASKS-224: Implementation Checklist for Autonomous Continuous Sentinel Daemon 24/7

**Document ID**: `TASKS-224-AUTONOMOUS-SENTINEL-DAEMON`  
**Specification Target**: `SPEC-362` / `CHANGE-224`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `COMPLETED`

---

## 1. Specification & Formal Verification Gate

- [x] **Task 1.1**: Author `docs/intake/eos-system/INTAKE-224-AUTONOMOUS-SENTINEL-DAEMON.md`.
- [x] **Task 1.2**: Author `openspec/changes/CHANGE-224-autonomous-sentinel-daemon.md`.
- [x] **Task 1.3**: Author `openspec/specs/SPEC-362-autonomous-sentinel-daemon.md` with formal EARS and BDD.
- [x] **Task 1.4**: Author `docs/plans/PLAN-224-AUTONOMOUS-SENTINEL-DAEMON.md` with ADR-224-001.
- [x] **Task 1.5**: Author `docs/tasks/TASKS-224-AUTONOMOUS-SENTINEL-DAEMON.md`.
- [x] **Task 1.6**: Record Level 3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **Task 1.7**: Author Leslie Lamport TLA+ Model 105 (`docs/formal/AutonomousSentinelDaemon.tla` and `.cfg`).
- [x] **Task 1.8**: Register in `scripts/run-tlc.mjs` and execute TLC validation (Exit Code 0).

---

## 2. Core Implementation

- [x] **Task 2.1**: Author `src/core/eosAutonomousSentinelDaemon.types.ts` defining health probes, anomalies, leases, and PR structures ($\le 800$ lines).
- [x] **Task 2.2**: Author `src/core/eosAutonomousSentinelDaemon.ts` implementing heartbeat loop, probe evaluators, drift detector, swarm dispatcher, and PR synthesizer ($\le 800$ lines).
- [x] **Task 2.3**: Export in `src/core/index.ts`.

---

## 3. Toolchain & CLI Integration

- [x] **Task 3.1**: Author `bin/commands/cliAutonomousSentinelDaemon.mjs` supporting `toolchain:sentinel:start`, `toolchain:sentinel:status`, `toolchain:sentinel:probe`, and `toolchain:sentinel:audit`.
- [x] **Task 3.2**: Register dispatcher in `bin/commands/cliToolchainRouter.mjs`.
- [x] **Task 3.3**: Document commands in `bin/commands/cliHelpCatalog.mjs`.

---

## 4. Phase 8 MCP Tool Wiring

- [x] **Task 4.1**: Register `eos_autonomous_sentinel_audit` in `src/core/eosMcpToolTaxonomy.ts`.
- [x] **Task 4.2**: Define tool schema in `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`.
- [x] **Task 4.3**: Implement handler in `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`.
- [x] **Task 4.4**: Update `docs/contracts/mcp-tool-catalog.json`.

---

## 5. Automated Verification & Delivery

- [x] **Task 5.1**: Author `test/eosAutonomousSentinelDaemon.test.mjs` verifying `BDD-1951` through `BDD-1956`.
- [x] **Task 5.2**: Run test suite and verify 100% pass rate.
- [x] **Task 5.3**: Run `node scripts/tip-refresh.mjs` and `npm run hygiene:audit`.
- [x] **Task 5.4**: Run Prettier and supply chain bind.
- [x] **Task 5.5**: Git commit, seal release pin, and push to `origin/main`.
