# TASKS-233: Institutional Quantitative Trading Engine & Byzantine Consensus Crucible

**Component:** `eos-system-control-plane`  
**Specification:** `SPEC-371` | **Change:** `CHANGE-233`  
**Status:** READY_FOR_EXECUTION

---

## Atomic Task Dependency Graph (DAG)

- [x] **TASK-233-01:** Formalize intake and OpenSpec change proposal (`INTAKE-233`, `CHANGE-233`).
- [x] **TASK-233-02:** Formalize specification with IEEE 830 EARS and BDD scenarios (`SPEC-371`).
- [x] **TASK-233-03:** Formulate architecture plan and ADR-233-001 (`PLAN-233`).
- [ ] **TASK-233-04:** Record formal Level 2+ implementation authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] **TASK-233-05:** Write Leslie Lamport TLA+ formal specification model and TLC configuration (`InstitutionalTradingEngine.tla`, `.cfg`).
- [ ] **TASK-233-06:** Model check TLA+ specification with TLC to exit code 0.
- [ ] **TASK-233-07:** Implement TypeScript types in `src/core/eosInstitutionalTradingEngine.types.ts`.
- [ ] **TASK-233-08:** Implement core domain logic in `src/core/eosInstitutionalTradingEngine.ts`.
- [ ] **TASK-233-09:** Export trading engine interfaces and factories in `src/core/index.ts`.
- [ ] **TASK-233-10:** Implement CLI command handlers in `bin/commands/cliTradingEngine.mjs`.
- [ ] **TASK-233-11:** Register commands in `bin/commands/cliHelpCatalog.mjs` and route in `bin/commands/cliToolchainRouter.mjs`.
- [ ] **TASK-233-12:** Register Phase 8 MCP tool `eos_institutional_trading_audit` in `src/mcp/eosMcpServer.ts`.
- [ ] **TASK-233-13:** Implement BDD test suite in `test/eosInstitutionalTradingEngine.test.mjs`.
- [ ] **TASK-233-14:** Run full merge gate `npm run verify:strict`, update freeze gate, and verify 0 broken invariants.
