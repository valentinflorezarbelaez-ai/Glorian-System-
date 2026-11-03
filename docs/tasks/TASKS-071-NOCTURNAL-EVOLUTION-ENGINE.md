# Atomic Task DAG: TASKS-071 — Glorian Nocturnal Darwinian Evolution & Dead-Code Eradication Engine

**Milestone**: v91.0.0 (SPEC-133 / CHANGE-071)  
**Status**: IN_PROGRESS  

---

## 1. Task Decomposition DAG

```
[TASK-01: Spec & Authorizations]
       │
       ▼
[TASK-02: Implement EosNocturnalEvolutionEngine in src/core/eosNocturnalEvolutionEngine.ts]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[TASK-03: Register CLI in bin/eos.mjs]   [TASK-04: Register MCP in src/mcp/eosMcpServer.ts]
       │                                 │
       └────────────────┬────────────────┘
                        ▼
       [TASK-05: Unit Test Suite in test/eosNocturnalEvolution.test.mjs]
                        │
                        ▼
       [TASK-06: Verification & OpenSpec Catalog Index Sync]
```

## 2. Tasks Description & Done-Criteria

- [x] **TASK-01: Author Specification & Architecture Package**
  - *Done-Criteria*: `INTAKE-071`, `SPEC-133`, `CHANGE-071`, `PLAN-071`, `TASKS-071` authored; authorization recorded in `IMPLEMENTATION_AUTHORIZATION.md`.

- [x] **TASK-02: Implement Core Engine in `src/core/eosNocturnalEvolutionEngine.ts`**
  - *Done-Criteria*: Layer-0 Pure TypeScript module created with refactor audit integration, multivariate fitness calculation, ANSI TUI formatting, and SHA-256 seal.

- [x] **TASK-03: Register CLI Subcommand `night:evolve` in `bin/eos.mjs`**
  - *Done-Criteria*: Executing `node bin/eos.mjs night:evolve --dry-run` runs cleanly with exit code 0.

- [x] **TASK-04: Register MCP Tool `eos_nocturnal_evolution` in `src/mcp/eosMcpServer.ts`**
  - *Done-Criteria*: Expose `eos_nocturnal_evolution` in `tools/list` and `tools/call`. Pass schema validation `npm run mcp:verify`.

- [x] **TASK-05: Implement Test Suite in `test/eosNocturnalEvolution.test.mjs`**
  - *Done-Criteria*: 100% test coverage of BDD-350, BDD-351, and BDD-352.

- [x] **TASK-06: End-to-End Pipeline Verification & OpenSpec Sync**
  - *Done-Criteria*: Update `docs/specs/openspec-catalog-index.json` to 133 specs; execute `node scripts/verify-cicd-pipeline.mjs --pts` with exit code 0.
