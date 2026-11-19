# TASKS-207: Closed-Loop Knowledge Graph & Semantic Reflex Engine (`SPEC-345`)

- **Change ID**: `CHANGE-207`
- **Spec**: `SPEC-345`
- **Status**: `READY_FOR_EXECUTION`

---

## Task Dependency Graph (DAG)

```text
[TASK-207-01: Auth Gate] ──────────┐
                                   ▼
[TASK-207-02: TLA+ Model] ─────────┼─► [TASK-207-04: Core Implementation] ─► [TASK-207-05: CLI & Router] ─► [TASK-207-06: Test Suite] ─► [TASK-207-07: Verify & Seal]
                                   ▲
[TASK-207-03: Types Definition] ──┘
```

---

## Atomic Tasks

- [x] **TASK-207-01**: Record Level 3 Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-207-02**: Author TLA+ formal model `docs/formal/KnowledgeGraphReflex.tla` and `docs/formal/KnowledgeGraphReflex.cfg` (Model 88).
- [x] **TASK-207-03**: Create TypeScript interfaces in `src/core/eosKnowledgeGraphReflex.types.ts`.
- [x] **TASK-207-04**: Implement `EosKnowledgeGraphReflexCore` in `src/core/eosKnowledgeGraphReflex.ts` ($\le 800$ lines, $\ge 12$ headroom).
- [x] **TASK-207-05**: Implement CLI handler `bin/commands/cliKnowledgeGraphReflex.mjs` and register in `bin/commands/cliToolchainRouter.mjs` and MCP Phase 8 tools.
- [x] **TASK-207-06**: Implement automated test suite `test/eosKnowledgeGraphReflex.test.mjs` verifying BDD-1849..BDD-1854.
- [x] **TASK-207-07**: Execute `npm run verify:strict`, seal freeze gate with `npm run tip-refresh && npm run tip-refresh:seal`, commit and push to `origin/main`.
