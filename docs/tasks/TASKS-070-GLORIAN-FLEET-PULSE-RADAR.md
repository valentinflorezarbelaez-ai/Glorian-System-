# Atomic Task DAG: TASKS-070 — Glorian Fleet Pulse & Tactical Sovereignty Radar

**Milestone**: v90.0.0 (SPEC-132 / CHANGE-070)  
**Status**: IN_PROGRESS  

---

## 1. Task Decomposition DAG

```
[TASK-01: Spec & Authorizations]
       │
       ▼
[TASK-02: Implement EosFleetPulseEngine in src/core/eosFleetPulseEngine.ts]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[TASK-03: Register CLI in bin/eos.mjs]   [TASK-04: Register MCP in src/mcp/eosMcpServer.ts]
       │                                 │
       └────────────────┬────────────────┘
                        ▼
       [TASK-05: Unit Test Suite in test/eosFleetPulseEngine.test.mjs]
                        │
                        ▼
       [TASK-06: Verification & OpenSpec Catalog Index Sync]
```

## 2. Tasks Description & Done-Criteria

- [x] **TASK-01: Author Specification & Architecture Package**
  - *Done-Criteria*: `INTAKE-070`, `SPEC-132`, `CHANGE-070`, `PLAN-070`, `TASKS-070` authored; authorization recorded in `IMPLEMENTATION_AUTHORIZATION.md`.

- [x] **TASK-02: Implement Core Engine in `src/core/eosFleetPulseEngine.ts`**
  - *Done-Criteria*: Layer-0 Pure TypeScript module created with path resolution, git status, archetype mapping, TUI table formatting, and SHA-256 seal.

- [x] **TASK-03: Register CLI Subcommand `fleet:pulse` in `bin/eos.mjs`**
  - *Done-Criteria*: Executing `node bin/eos.mjs fleet:pulse` prints the ANSI TUI formatted table with exit code 0.

- [x] **TASK-04: Register MCP Tool `eos_fleet_pulse` in `src/mcp/eosMcpServer.ts`**
  - *Done-Criteria*: Expose `eos_fleet_pulse` in `tools/list` and `tools/call`. Pass schema validation `npm run mcp:verify`.

- [x] **TASK-05: Implement Test Suite in `test/eosFleetPulseEngine.test.mjs`**
  - *Done-Criteria*: 100% test coverage of BDD-340, BDD-341, BDD-342, and BDD-343.

- [x] **TASK-06: End-to-End Pipeline Verification & OpenSpec Sync**
  - *Done-Criteria*: Update `docs/specs/openspec-catalog-index.json` to 132 specs; execute `node scripts/verify-cicd-pipeline.mjs --pts` with exit code 0.
