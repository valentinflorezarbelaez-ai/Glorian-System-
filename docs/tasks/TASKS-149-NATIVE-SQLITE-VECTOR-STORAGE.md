# TASKS-149: Native node:sqlite Storage, FTS5 Search & Quantized Vector Governor

- **Change ID**: `CHANGE-149`
- **Spec ID**: `SPEC-287`
- **Component**: `Glorian System / Layer-0 Embedded Storage & Semantic Retrieval`
- **Status**: `READY_FOR_EXECUTION`
- **Date**: 2026-11-15

---

## 1. Task Dependency Graph (DAG)

```text
[Task 1: Declarative Schema Template]
                 │
                 ▼
[Task 2: Core Sqlite Store Module] ──► [Task 3: Core Exports]
                 │
                 ▼
[Task 4: CLI Subcommands & Wiring]
                 │
                 ▼
[Task 5: CLI Catalog & Developer Guide]
                 │
                 ▼
[Task 6: Test Suite (BDD-1497..1502)]
                 │
                 ▼
[Task 7: Level 3 Authorization & Audit Gate]
```

---

## 2. Detailed Task Breakdown

### Task 1: Declarative Schema Template

- Author `templates/storage/sample-sqlite-schema.sql` defining `documents`, `documents_fts` virtual table, and indices.

### Task 2: Core Store Module Implementation

- Author `src/core/eosNativeSqliteStore.ts`:
  - `DatabaseSync` lifecycle management (in-memory `:memory:` or file path).
  - WAL pragma configuration (`journal_mode = WAL`, `synchronous = NORMAL`).
  - Document insertion and atomic transactions (`transaction(fn)`).
  - FTS5 full-text lexical search (`searchFts(query, limit)`).
  - Quantized vector BLOB storage & k-NN cosine retrieval (`searchVector(queryVec, limit)`).
  - Hybrid Reciprocal Rank Fusion (`searchHybrid(query, queryVec, limit)`).
  - Cryptographic audit receipt emission (`docs/evidence/SQLITE_STORAGE_RECEIPT.json`).
  - Strict line ceiling $\le 800$ lines.

### Task 3: Core Export Integration

- Export `EosNativeSqliteStore` and types in `src/core/index.ts`.

### Task 4: CLI Subcommands & Wiring

- Author `bin/commands/cliSqliteStore.mjs`:
  - `toolchain:sqlite:audit`: Execute storage audit and emit receipt.
  - `toolchain:sqlite:query`: Run FTS5 lexical queries across stored documents.
  - `toolchain:sqlite:vector`: Run k-NN vector search against quantized embeddings.
- Wire dynamic delegation in `bin/commands/cliDevOps.mjs`.

### Task 5: Catalog Registration & Documentation

- Register subcommands in `bin/commands/cliHelpCatalog.mjs`.
- Document usage in `docs/DEVELOPER_GUIDE.md`.

### Task 6: Test Suite Authoring & Execution

- Author `test/eosNativeSqliteStore.test.mjs` validating BDD-1497..BDD-1502.
- Run tests with `node --test test/eosNativeSqliteStore.test.mjs`.

### Task 7: Authorization & Verification

- Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- Run `npm run hygiene:audit`.
- Seal freeze pin and push.
