# INTAKE-141: Distributed Vector Memory & Hybrid Search Engine (Big Tech Standard)

## 1. Context & Business Intent
- **Initiative**: Glorian System (EOS Control Plane) — Horizon 2, Engine 2.
- **Requester**: Principal Architect & System Owner (Valentín Flórez Arbeláez).
- **Date**: 2026-11-03.
- **Status**: `INTAKE_APPROVED`.

### Problem Statement
Glorian System currently possesses 140 formal OpenSpecs (`openspec/specs/`), 83 change records, hundreds of architectural ADRs, and 177 TypeScript modules. However, knowledge discovery is fragmented:
1. `createDefaultEosKnowledgeStore()` only holds 6 static mock documents in memory.
2. `EosDocumentationSearch` utilizes native `node:sqlite` FTS5 (`unicode61`) for lexical queries, but lacks high-dimensional semantic understanding and does not index code AST symbols.
3. `EosHnswVectorEngine` implements a pure Layer-0 in-memory HNSW graph, but is volatile, unpersisted, and disconnected from the SQLite storage layer and MCP tools.
4. Autonomous agents (Cursor, Antigravity, Claude Code, and internal agents) cannot execute hybrid semantic retrieval fusing exact identifiers (e.g. `SPEC-140`, `ADR-0172`) with natural conceptual semantics (e.g. "reconnect stream with ring buffer replay").

### Strategic Objective
Implement a production-grade, distributed-ready **Hybrid Neural Knowledge Engine** adhering strictly to Big Tech standards (Palantir Gotham/Foundry, Google Search/Vertex, Anduril Lattice) with **Strict Layer-0 Purity** (`runtimeDependenciesCount: 0`):
1. **Persistent SQLite Vector & Lexical Store**:
   - Utilize native `node:sqlite` (`DatabaseSync`) with WAL mode (`PRAGMA journal_mode = WAL`) and synchronous normal.
   - Dual-index tables:
     - `eos_docs_fts`: FTS5 virtual table for BM25 lexical search with Porter/unicode61 tokenization.
     - `eos_vector_nodes`: Dense vector embeddings (Float32Array stored as raw binary BLOBs) with metadata and content hashes.
     - `eos_hnsw_edges`: Layered adjacency lists representing the HNSW graph topology on disk.
2. **Deterministic Layer-0 Dense Semantic Embeddings**:
   - 64-dimensional dense projection engine using subword n-gram hashing, positional token weighting, and L2 unit-sphere normalization without external API dependencies.
   - Zero-allocation SIMD-friendly vector operations (`Float32Array`).
3. **Hybrid Search via Reciprocal Rank Fusion (RRF)**:
   - Combine FTS5 lexical ranking and HNSW vector cosine similarity:
     `RRF(d) = Σ [ 1 / (60 + rank_lexical(d)) ] + Σ [ 1 / (60 + rank_vector(d)) ]`
   - Sub-5ms query response time across the entire corpus.
4. **Full Corpus Indexer**:
   - Automatically index all 140 OpenSpecs, 83 change records, ADRs, and TypeScript source module exports.
   - Incremental indexing via SHA-256 content hashing (< 15ms no-op overhead when unchanged).
5. **Unified MCP Tool Upgrade**:
   - Upgrade `eos_semantic_search` to query the live persistent hybrid store with domain filtering (`SPEC`, `CHANGE`, `CODE`, `ALL`).

---

## 2. Inviolable Constitutional Constraints
- **Law I (Specification as Supreme Truth)**: Zero code without approved EARS requirements and Gherkin BDD scenarios.
- **Law II (Strict Gate)**: Level 3 implementation authorization mandatory before touching production files.
- **Law III (Evidence Over Claims)**: Deterministic verification receipts (`EVD-SPEC-141.json`) with exit code 0.
- **Law V (Layer-0 Pure Purity)**: Exactly 0 runtime npm dependencies (`package.json` -> `dependencies: {}`). 100% native Node.js (`node:sqlite`, `node:crypto`, `node:fs`, `node:path`).
- **Law VI (Zero Plain Secrets)**: Zero hardcoded keys; air-gapped deterministic operation without network egress requirements.
