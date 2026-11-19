# TASKS-228: Implementation Checklist for SWE-Bench Autonomous Evaluation Harness & Fleet Eval Flywheel

**Document ID**: `TASKS-228-SWE-BENCH-EVALS-FLYWHEEL`  
**Specification Target**: `SPEC-366` / `CHANGE-228`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `IN_PROGRESS`

---

## 1. Specification & Formal Verification Gate

- [x] **Task 1.1**: Author `docs/intake/eos-system/INTAKE-228-SWE-BENCH-EVALS-FLYWHEEL.md`.
- [x] **Task 1.2**: Author `openspec/changes/CHANGE-228-swe-bench-evals-flywheel.md`.
- [x] **Task 1.3**: Author `openspec/specs/SPEC-366-swe-bench-evals-flywheel.md` with formal EARS and BDD.
- [x] **Task 1.4**: Author `docs/plans/PLAN-228-SWE-BENCH-EVALS-FLYWHEEL.md` with ADR-228-001.
- [x] **Task 1.5**: Author `docs/tasks/TASKS-228-SWE-BENCH-EVALS-FLYWHEEL.md`.
- [x] **Task 1.6**: Record Level 3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **Task 1.7**: Author Leslie Lamport TLA+ Model 109 (`docs/formal/SweBenchEvalFlywheel.tla` and `.cfg`).
- [x] **Task 1.8**: Register in `scripts/run-tlc.mjs` and execute TLC validation (Exit Code 0).

---

## 2. Core Implementation

- [x] **Task 2.1**: Author `src/core/eosSweBenchEvalFlywheel.types.ts` defining challenge specs, oracle grades, scorecards, pass@k estimators, and audit receipts ($\le 800$ lines).
- [x] **Task 2.2**: Author `src/core/eosSweBenchEvalFlywheel.ts` implementing hermetic sandboxing, patch application, oracle grading, synthetic git PR challenge mining, and statistical pass@k calculation ($\le 800$ lines).
- [x] **Task 2.3**: Export in `src/core/index.ts`.

---

## 3. Toolchain & CLI Integration

- [x] **Task 3.1**: Author `bin/commands/cliSweBenchEvalFlywheel.mjs` supporting `toolchain:eval:run`, `toolchain:eval:synthetic`, `toolchain:eval:matrix`, and `toolchain:eval:audit`.
- [x] **Task 3.2**: Register dispatcher in `bin/commands/cliToolchainRouter.mjs`.
- [x] **Task 3.3**: Document commands in `bin/commands/cliHelpCatalog.mjs`.

---

## 4. Phase 8 MCP Tool Wiring

- [x] **Task 4.1**: Register `eos_swe_bench_eval_flywheel_audit` in `src/core/eosMcpToolTaxonomy.ts`.
- [x] **Task 4.2**: Define tool schema in `src/mcp/tools/eosMcpPhase8ToolDefinitions.ts`.
- [x] **Task 4.3**: Implement handler in `src/mcp/tools/eosMcpPhase8AgiHandlers.ts`.
- [x] **Task 4.4**: Update `docs/contracts/mcp-tool-catalog.json`.

---

## 5. Automated Verification & Delivery

- [x] **Task 5.1**: Author `test/eosSweBenchEvalFlywheel.test.mjs` verifying `BDD-1975` through `BDD-1980`.
- [x] **Task 5.2**: Run test suite and verify 100% pass rate.
- [x] **Task 5.3**: Run `node scripts/tip-refresh.mjs` and `npm run hygiene:audit`.
- [x] **Task 5.4**: Run Prettier and supply chain bind.
- [ ] **Task 5.5**: Git commit, seal release pin, and push to `origin/main`.
