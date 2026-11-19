# TASKS-208: Autonomous Multi-Agent Swarm Orchestrator with Byzantine Fault Tolerance (`SPEC-346`)

- **Change ID**: `CHANGE-208`
- **Spec**: `SPEC-346`
- **Status**: `READY_FOR_EXECUTION`

---

## Task Dependency Graph (DAG)

```text
[TASK-208-01: Auth Gate] ──────────┐
                                   ▼
[TASK-208-02: TLA+ Model] ─────────┼─► [TASK-208-04: Core Implementation] ─► [TASK-208-05: CLI & Router] ─► [TASK-208-06: Test Suite] ─► [TASK-208-07: Verify & Seal]
                                   ▲
[TASK-208-03: Types Definition] ──┘
```

---

## Atomic Tasks

- [x] **TASK-208-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-208-02**: Author TLA+ formal model `docs/formal/AgenticSwarmBft.tla` and `docs/formal/AgenticSwarmBft.cfg` (Model 89).
- [x] **TASK-208-03**: Create TypeScript interfaces in `src/core/eosAgenticSwarmBft.types.ts`.
- [x] **TASK-208-04**: Implement `EosAgenticSwarmBftCore` in `src/core/eosAgenticSwarmBft.ts` ($\le 800$ lines, $\ge 12$ headroom).
- [x] **TASK-208-05**: Implement CLI handler `bin/commands/cliAgenticSwarmBft.mjs` and register in `bin/commands/cliToolchainRouter.mjs` and Phase 8 MCP tools.
- [x] **TASK-208-06**: Implement automated test suite `test/eosAgenticSwarmBft.test.mjs` verifying BDD-1855..BDD-1860.
- [x] **TASK-208-07**: Execute `npm run verify:strict`, seal freeze gate with `npm run tip-refresh && npm run tip-refresh:seal`, commit and push to `origin/main`.
