# INTAKE-149: Native node:sqlite Storage, FTS5 Search & Quantized Vector Governor

- **Change ID**: `CHANGE-149`
- **Specification ID**: `SPEC-287`
- **Module ID**: `EosNativeSqliteStore`
- **Domain**: Embedded ACID Database, Full-Text Search (FTS5) & Quantized Vector Indexing
- **System Owner**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-11-15

---

## 1. Context & Operational Baseline

Historically, agent state, document retrieval, and session memories within Glorian System relied on in-memory maps or client-side `localStorage`. This ephemeral storage prevents persistent agent sessions across CLI restarts, lacks fast lexical search across thousands of specifications, and cannot run transactional rollbacks under concurrent agent mutations.

Node.js 22.18+ provides built-in `node:sqlite` (`DatabaseSync`), which natively supports:

1. Strict ACID transactions with Write-Ahead Logging (`PRAGMA journal_mode = WAL`).
2. Virtual tables with **FTS5** (Full-Text Search 5) for ultra-fast BM25 tokenized lexical retrieval.
3. Native BLOB storage for scalar quantized Uint8 vector embeddings (`SPEC-283`).
4. Zero third-party npm dependencies (`dependencies: {}` - Law V).

Glorian System requires an embedded, high-performance database governor wrapping `node:sqlite` to provide transactional document storage, FTS5 lexical matching, SIMD-style quantized vector search, and cryptographic proof receipt emission.

---

## 2. Requirements Baseline (EARS Syntax)

- **FR-287-01 (Event-Driven ACID Transaction)**: WHEN an agent transaction executes, THE SYSTEM SHALL execute all inserts, updates, or deletions atomically within a SQLite transaction, rolling back completely on any statement failure.
- **FR-287-02 (State-Driven WAL Mode)**: WHILE initializing database instances on persistent storage, THE SYSTEM SHALL enforce Write-Ahead Logging (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) to guarantee high-concurrency non-blocking reads.
- **FR-287-03 (Lexical FTS5 Retrieval)**: WHEN a lexical query is executed against indexed document records, THE SYSTEM SHALL execute BM25 matching via SQLite FTS5 virtual tables and return ranked document matches with BM25 scores.
- **FR-287-04 (Quantized Vector Indexing & k-NN Retrieval)**: WHEN vector embeddings are stored, THE SYSTEM SHALL serialize quantized Uint8Array vectors into SQLite BLOB columns and execute cosine similarity k-NN search across stored records in $O(N)$ unrolled loops.
- **FR-287-05 (Hybrid RRF Fusion Scoring)**: WHEN a hybrid search query is submitted, THE SYSTEM SHALL compute Reciprocal Rank Fusion (RRF) combining FTS5 lexical rank and vector cosine similarity rank.
- **FR-287-06 (Cryptographic Attestation Receipt)**: WHEN an audit or storage inspection occurs, THE SYSTEM SHALL emit a cryptographic receipt at `docs/evidence/SQLITE_STORAGE_RECEIPT.json` sealed with a SHA-256 signature.

---

## 3. Epistemic Assessment & Deliverables

- **Epistemic State**: `INTAKE_RECORDED`
- **Target Implementation**: `src/core/eosNativeSqliteStore.ts`
- **CLI Subcommands**: `toolchain:sqlite:audit`, `toolchain:sqlite:query`, `toolchain:sqlite:vector`
- **Test Suite**: `test/eosNativeSqliteStore.test.mjs` (BDD-1497..BDD-1502)
