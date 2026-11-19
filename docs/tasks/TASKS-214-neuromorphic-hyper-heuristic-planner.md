# TASKS-214: Autonomous Multi-Modal Neuromorphic Hyper-Heuristic Planner (`SPEC-352`)

- **Change ID**: `CHANGE-214`
- **Spec**: `SPEC-352`
- **Status**: `READY_FOR_EXECUTION`

---

## Task Dependency Graph (DAG)

```text
[TASK-214-01: Auth Gate] ──────────┐
                                   ▼
[TASK-214-02: TLA+ Model] ─────────┼─► [TASK-214-04: Core Planner] ─► [TASK-214-05: CLI & MCP] ─► [TASK-214-06: Test Suite] ─► [TASK-214-07: Verify & Seal]
                                   ▲
[TASK-214-03: Types Definition] ──┘
```

---

## Atomic Tasks

- [x] **TASK-214-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-214-02**: Author TLA+ formal model `docs/formal/NeuromorphicPlanner.tla` and `docs/formal/NeuromorphicPlanner.cfg` (Model 95).
- [x] **TASK-214-03**: Create TypeScript interfaces in `src/core/eosNeuromorphicPlanner.types.ts`.
- [x] **TASK-214-04**: Implement `EosHyperHeuristicPlannerCore` in `src/core/eosNeuromorphicPlanner.ts` ($\le 800$ lines, $\ge 12$ headroom, zero dependencies).
- [x] **TASK-214-05**: Implement CLI handler `bin/commands/cliNeuromorphicPlanner.mjs` and register in `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, and Phase 8 MCP tools.
- [x] **TASK-214-06**: Implement automated test suite `test/eosNeuromorphicPlanner.test.mjs` verifying BDD-1891..BDD-1896.
- [x] **TASK-214-07**: Execute `npm run verify:strict`, seal freeze gate with `npm run tip-refresh && npm run tip-refresh:seal`, commit and push to `origin/main`.
