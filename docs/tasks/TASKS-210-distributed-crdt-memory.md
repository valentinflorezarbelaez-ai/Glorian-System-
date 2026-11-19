# TASKS-210: Distributed Bitemporal CRDT Memory Synchronizer (`SPEC-348`)

- **Change ID**: `CHANGE-210`
- **Spec**: `SPEC-348`
- **Status**: `READY_FOR_EXECUTION`

---

## Task Dependency Graph (DAG)

```text
[TASK-210-01: Auth Gate] ──────────┐
                                   ▼
[TASK-210-02: TLA+ Model] ─────────┼─► [TASK-210-04: Core Implementation] ─► [TASK-210-05: CLI & Router] ─► [TASK-210-06: Test Suite] ─► [TASK-210-07: Verify & Seal]
                                   ▲
[TASK-210-03: Types Definition] ──┘
```

---

## Atomic Tasks

- [x] **TASK-210-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-210-02**: Author TLA+ formal model `docs/formal/DistributedCrdtMemory.tla` and `docs/formal/DistributedCrdtMemory.cfg` (Model 91).
- [x] **TASK-210-03**: Create TypeScript interfaces in `src/core/eosDistributedCrdtMemory.types.ts`.
- [x] **TASK-210-04**: Implement `EosDistributedCrdtMemoryCore` in `src/core/eosDistributedCrdtMemory.ts` ($\le 800$ lines, $\ge 12$ headroom).
- [x] **TASK-210-05**: Implement CLI handler `bin/commands/cliDistributedCrdtMemory.mjs` and register in `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, and Phase 8 MCP tools.
- [x] **TASK-210-06**: Implement automated test suite `test/eosDistributedCrdtMemory.test.mjs` verifying BDD-1867..BDD-1872.
- [x] **TASK-210-07**: Execute `npm run verify:strict`, seal freeze gate with `npm run tip-refresh && npm run tip-refresh:seal`, commit and push to `origin/main`.
