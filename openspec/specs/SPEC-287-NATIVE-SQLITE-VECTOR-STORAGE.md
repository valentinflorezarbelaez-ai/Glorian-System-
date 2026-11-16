# SPEC-287: Native node:sqlite Storage, FTS5 Search & Quantized Vector Governor

- **Specification ID**: `SPEC-287`
- **Change ID**: `CHANGE-149`
- **Status**: `APPROVED`
- **Module**: `src/core/eosNativeSqliteStore.ts`
- **Tier**: Embedded Storage / Semantic Vector Memory
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-287-01 (Event-Driven ACID Transaction)**: WHEN an agent transaction executes, THE SYSTEM SHALL execute all inserts, updates, or deletions atomically within a SQLite transaction, rolling back completely on any statement failure.
- **FR-287-02 (State-Driven WAL Mode)**: WHILE initializing database instances on persistent storage, THE SYSTEM SHALL enforce Write-Ahead Logging (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) to guarantee high-concurrency non-blocking reads.
- **FR-287-03 (Lexical FTS5 Retrieval)**: WHEN a lexical query is executed against indexed document records AND the runtime `node:sqlite` build reports `ENABLE_FTS5`, THE SYSTEM SHALL execute BM25 matching via SQLite FTS5 virtual tables and return ranked document matches. IF the runtime lacks the FTS5 module, THE SYSTEM SHALL rank the same tokens over `title` and `content` with a deterministic token scorer and report `fts5Enabled` as false.
- **FR-287-04 (Quantized Vector Indexing & k-NN Retrieval)**: WHEN vector embeddings are stored, THE SYSTEM SHALL serialize quantized Uint8Array vectors into SQLite BLOB columns and execute cosine similarity k-NN search across stored records in $O(N)$ unrolled loops.
- **FR-287-05 (Hybrid RRF Fusion Scoring)**: WHEN a hybrid search query is submitted, THE SYSTEM SHALL compute Reciprocal Rank Fusion (RRF) combining FTS5 lexical rank and vector cosine similarity rank.
- **FR-287-06 (Cryptographic Attestation Receipt)**: WHEN an audit or storage inspection occurs, THE SYSTEM SHALL emit a cryptographic receipt at `docs/evidence/SQLITE_STORAGE_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1497 Embedded SQLite Initialization and ACID Transaction Rollback
  GIVEN an EosNativeSqliteStore initialized in-memory or on disk
  WHEN a batch of document inserts is performed inside an atomic transaction
  AND a forced exception is triggered before commit
  THEN the transaction aborts and 0 rows are committed to the database.

SCENARIO: BDD-1498 Write-Ahead Logging (WAL) Mode Enforcement
  GIVEN an EosNativeSqliteStore initialized on a file path
  WHEN the database pragma settings are queried
  THEN journal_mode returns "wal" and synchronous returns "1" (NORMAL).

SCENARIO: BDD-1499 Full-Text Search (FTS5) BM25 Token Matching
  GIVEN an FTS5 virtual table populated with software architecture specifications
  WHEN a search query with boolean operators or prefix matching is executed
  THEN matching documents are returned sorted by relevance rank.

SCENARIO: BDD-1500 Quantized Vector BLOB Storage and Cosine k-NN Retrieval
  GIVEN a collection of document embeddings quantized to Uint8Array [0..255]
  WHEN the vectors are stored in SQLite BLOB columns
  AND a k-NN search is queried for query vector Q
  THEN the top-K closest documents by cosine similarity are returned accurately.

SCENARIO: BDD-1501 Hybrid Lexical and Semantic Reciprocal Rank Fusion (RRF)
  GIVEN documents indexed with both FTS5 text and vector embeddings
  WHEN a hybrid query is submitted with both query text and query vector
  THEN RRF fusion computes score = 1/(60 + rank_lexical) + 1/(60 + rank_vector)
  AND returns unified ranked search results.

SCENARIO: BDD-1502 Cryptographic Audit Receipt Verification
  GIVEN a database audit executed via toolchain:sqlite:audit
  WHEN the audit completes
  THEN docs/evidence/SQLITE_STORAGE_RECEIPT.json is written
  AND contains totalDocuments, fts5Enabled, vectorCount, and a valid sha256Signature.
```
