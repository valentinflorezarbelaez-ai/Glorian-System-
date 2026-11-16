# CHANGE-149: Native node:sqlite Storage, FTS5 Search & Quantized Vector Governor

- **Change ID**: `CHANGE-149`
- **Spec ID**: `SPEC-287`
- **Component**: `Glorian System / Embedded Storage & Semantic Memory`
- **Lifecycle**: `PROPOSED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Target Release**: `v45.0.0`
- **Dependencies**: None (Zero Layer-0 external npm dependencies; uses built-in `node:sqlite`)

---

## 1. Motivation & Problem Statement

Glorian System's agent workflows (MCP, Honk, flow inspect) require an industrial-strength, embedded persistent storage layer. Storing agent states in raw files or in-memory tables creates concurrency hazards, risks partial writes on crashes, and lacks fast indexing across thousands of specifications and codebase symbols.

`CHANGE-149` introduces `EosNativeSqliteStore`, providing:

1. Native `node:sqlite` (`DatabaseSync`) driver integration with zero npm dependencies.
2. ACID transaction boundaries with WAL journal mode.
3. Full-Text Search 5 (FTS5) virtual table indexing for tokenized BM25 search.
4. BLOB column serialization of Scalar Quantized (SQ8) vectors for fast k-NN search.
5. Hybrid Reciprocal Rank Fusion (RRF) combining FTS5 lexical matching with vector similarity.
6. Cryptographic audit receipts at `docs/evidence/SQLITE_STORAGE_RECEIPT.json`.

---

## 2. Delta Specification

- **Added Files**:
  - `src/core/eosNativeSqliteStore.ts`: Native SQLite storage and vector indexing engine.
  - `bin/commands/cliSqliteStore.mjs`: CLI command handlers (`audit`, `query`, `vector`).
  - `test/eosNativeSqliteStore.test.mjs`: BDD test suite covering BDD-1497..BDD-1502.
  - `templates/storage/sample-sqlite-schema.sql`: Declarative table schema with FTS5 virtual table.
- **Modified Files**:
  - `src/core/index.ts`: Export `EosNativeSqliteStore` and types.
  - `bin/commands/cliDevOps.mjs`: Dynamic delegation for `toolchain:sqlite:`.
  - `bin/commands/cliHelpCatalog.mjs`: Catalog new subcommands.
  - `docs/DEVELOPER_GUIDE.md`: Document CLI usage and examples.
  - `IMPLEMENTATION_AUTHORIZATION.md`: Record Level 3 authorization.

---

## 3. Verification Plan

- Unit & BDD tests with `node --test test/eosNativeSqliteStore.test.mjs`.
- In-memory (`:memory:`) and file-based SQLite tests verifying WAL mode and crash safety.
- Verification of FTS5 search queries and vector cosine similarity over BLOB data.
- Full 7-stage CI/CD gate validation.
