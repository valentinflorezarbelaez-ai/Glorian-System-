# TASKS-226: Implementation Checklist for Fleet Chaos Monkey & Autonomous FDIR Engine

**Document ID**: `TASKS-226-FLEET-CHAOS-FDIR`  
**Specification Target**: `SPEC-364` / `CHANGE-226`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `IN_PROGRESS`

---

## 1. Specification & Formal Verification Gate

- [x] **Task 1.1**: Author `docs/intake/eos-system/INTAKE-226-FLEET-CHAOS-FDIR.md`.
- [x] **Task 1.2**: Author `openspec/changes/CHANGE-226-fleet-chaos-fdir.md`.
- [x] **Task 1.3**: Author `openspec/specs/SPEC-364-fleet-chaos-fdir.md` with formal EARS and BDD.
- [x] **Task 1.4**: Author `docs/plans/PLAN-226-FLEET-CHAOS-FDIR.md` with ADR-226-001.
- [x] **Task 1.5**: Author `docs/tasks/TASKS-226-FLEET-CHAOS-FDIR.md`.
- [x] **Task 1.6**: Record Level 3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **Task 1.7**: Author Leslie Lamport TLA+ Model 107 (`docs/formal/FleetChaosFdirEngine.tla` and `.cfg`).
- [x] **Task 1.8**: Register in `scripts/run-tlc.mjs` and execute TLC validation (Exit Code 0).

---

## 2. Core Implementation

- [x] **Task 2.1**: Author `src/core/eosFleetChaosMonkey.types.ts` defining chaos vectors, FDIR states, MTTR metrics, and audit receipts ($\le 800$ lines).
- [x] **Task 2.2**: Author `src/core/eosFleetChaosMonkey.ts` implementing 6 fault injection vectors, sub-50ms detection, hermetic isolation, and sub-500ms self-healing recovery ($\le 800$ lines).
- [x] **Task 2.3**: Export in `src/core/index.ts`.

---

## 3. Toolchain & CLI Integration

- [x] **Task 3.1**: Author `bin/commands/cliFleetChaosMonkey.mjs` supporting `toolchain:chaos:inject`, `toolchain:chaos:fdir`, `toolchain:chaos:fleet`, and `toolchain:chaos:audit`.
- [x] **Task 3.2**: Register dispatcher in `bin/commands/cliToolchainRouter.mjs`.
- [x] **Task 3.3**: Document commands in `bin/commands/cliHelpCatalog.mjs`.

---

## 4. Phase 8 MCP Tool Wiring

- [x] **Task 4.1**: Register `eos_fleet_chaos_monkey_audit` in `src/core/eosMcpToolTaxonomy.ts`.
- [x] **Task 4.2**: Define tool schema in `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`.
- [x] **Task 4.3**: Implement handler in `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`.
- [x] **Task 4.4**: Update `docs/contracts/mcp-tool-catalog.json`.

---

## 5. Automated Verification & Delivery

- [x] **Task 5.1**: Author `test/eosFleetChaosMonkey.test.mjs` verifying `BDD-1963` through `BDD-1968`.
- [x] **Task 5.2**: Run test suite and verify 100% pass rate.
- [x] **Task 5.3**: Run `node scripts/tip-refresh.mjs` and `npm run hygiene:audit`.
- [x] **Task 5.4**: Run Prettier and supply chain bind.
- [ ] **Task 5.5**: Git commit, seal release pin, and push to `origin/main`.
