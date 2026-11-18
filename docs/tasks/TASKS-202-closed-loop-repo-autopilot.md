# TASKS-202: Sovereign Closed-Loop Repository Autopilot Engine

## Implementation Tasks (DAG)

- [x] **TASK-202-01**: Record intake in `docs/intake/eos-system/INTAKE-202-CLOSED-LOOP-REPO-AUTOPILOT.md`.
- [x] **TASK-202-02**: Author change proposal `openspec/changes/CHANGE-202-closed-loop-repo-autopilot.md`.
- [x] **TASK-202-03**: Formalize `openspec/specs/SPEC-340-closed-loop-repo-autopilot.md` (`FR-1`..`FR-6`, `BDD-1815`..`BDD-1820`).
- [x] **TASK-202-04**: Author `docs/plans/PLAN-202-closed-loop-repo-autopilot.md` (`ADR-202-001`..`003`).
- [x] **TASK-202-05**: Author this task list.
- [x] **TASK-202-06**: Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-202-07**: Author and TLC-verify TLA+ Model 84 (`ClosedLoopRepoAutopilot.tla` & `.cfg`).
- [x] **TASK-202-08**: Author `src/core/eosClosedLoopRepoAutopilot.types.ts` and `src/core/eosClosedLoopRepoAutopilot.ts`.
- [x] **TASK-202-09**: Export from `src/core/index.ts` (`SPEC-250` compliant).
- [x] **TASK-202-10**: Implement `bin/commands/cliClosedLoopRepoAutopilot.mjs`, router, catalog & `DEVELOPER_GUIDE.md` (`623 -> 628`).
- [x] **TASK-202-11**: Expose `eos_closed_loop_autopilot_audit` in Native MCP Server (`src/mcp/` & `src/core/eosMcpToolTaxonomy.ts`).
- [x] **TASK-202-12**: Author `test/eosClosedLoopRepoAutopilot.test.mjs` (`BDD-1815`..`BDD-1820`) and register in `scripts/mutation-gate.mjs` ($\ge 85\%$).
- [x] **TASK-202-13**: Verify all gates (`run-tlc.mjs`, `typecheck`, `hygiene:audit`, `eosSpecDriftDetector`, `eosModuleSizeBudget`, `eosMcpSchemaValidator`) and push to `origin/main`.
