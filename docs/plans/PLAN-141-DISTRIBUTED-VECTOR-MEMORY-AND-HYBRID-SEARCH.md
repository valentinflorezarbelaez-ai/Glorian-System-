# PLAN-141: Architecture Plan — Distributed Vector Memory & Hybrid Search Engine

## 1. Architectural Decision Records (ADR)

### ADR-0174: Hybrid Reciprocal Rank Fusion Architecture (FTS5 BM25 + HNSW Cosine)
- **Status**: `ACCEPTED`
- **Context**: Autonomous agents querying a large software codebase with 140+ specifications face two distinct search needs:
  1. **Lexical exact matches**: Searching for exact identifiers, error codes, RFC standards, or file paths (e.g. `SPEC-140`, `ADR-0172`, `crypto.timingSafeEqual`, `Last-Event-ID`).
  2. **Semantic conceptual matches**: Searching for abstract architectural concepts (e.g. "stream disconnection resilience", "timing attack prevention on bearer token", "pure layer-0 build provenance").
  Neither pure vector search nor pure BM25 full-text search excels at both. Dense vector search can hallucinate or downrank exact alphanumeric code identifiers, while BM25 fails to bridge vocabulary mismatch gaps.
- **Decision**: Implement a **Hybrid Search Engine** combining SQLite's native FTS5 full-text search with an in-memory/persisted HNSW dense vector graph index, fused using **Reciprocal Rank Fusion (RRF)**:
  $$RRF(d) = \sum_{m \in \{lexical, vector\}} \frac{1}{k_{rrf} + \text{rank}_m(d)}$$
  with the industry standard constant $k_{rrf} = 60$.
- **Rejected Alternatives**:
  - *Pure BM25*: Rejects conceptual discovery and synonym matching.
  - *Pure Vector k-NN*: Degrades search precision on exact code identifiers, error strings, and file paths.
  - *Linear Score Interpolation ($\alpha \cdot \text{lexical} + (1-\alpha) \cdot \text{vector}$)*: Requires fragile cross-score calibration and normalization across disparate scales.
- **Consequences**:
  - Positive: Guarantees optimal ranking whether the query is an exact technical identifier, natural language question, or hybrid query.
  - Positive: Deterministic, predictable, and requires zero hyperparameter retraining.

---

### ADR-0175: Layer-0 Pure Dense Vector Persistence in SQLite BLOBs and Adjacency Tables
- **Status**: `ACCEPTED`
- **Context**: Big Tech production agent environments require persistent vector storage that survives process restarts without expensive re-indexing, while adhering to Glorian's constitutional Law V (`runtimeDependenciesCount: 0`). External vector databases (Chroma, Pinecone, Weaviate) or native C++ add-ons (sqlite-vec, faiss) introduce external dependencies, native compilation friction, and supply chain attack surfaces.
- **Decision**:
  1. Utilize Node.js native `node:sqlite` (`DatabaseSync`) which is built into Node.js 22.5+ and 24.
  2. Store 64-dimensional normalized vector embeddings directly as binary `BLOB` buffers (`Buffer.from(float32Array.buffer)`) in SQLite table `eos_vector_nodes`.
  3. Store HNSW graph adjacency lists as serialized binary or JSON buffers in `eos_vector_edges`.
  4. On startup, load existing graph topology into memory in < 5ms, avoiding full index reconstruction.
  5. Fallback gracefully to `:memory:` mode when in serverless (Vercel) or read-only environments.
- **Rejected Alternatives**:
  - *External sqlite-vec extension*: Violates pure Layer-0 constraint (`runtimeDependenciesCount: 0`) and fails on cross-OS CI runners without prebuilt binaries.
  - *JSON array string storage*: Incurs 4x-6x memory overhead and JSON parsing latency compared to direct binary `BLOB` copying.
- **Consequences**:
  - Positive: 100% pure Layer-0 zero-dependency implementation running natively across Windows, Linux, and macOS.
  - Positive: Sub-5ms cold startup and sub-microsecond vector operations on `Float32Array`.

---

## 2. Component Layout & Responsibilities

| Component | Target File | Responsibility |
|---|---|---|
| **Hybrid Knowledge Engine** | `src/core/eosHybridKnowledgeEngine.ts` | Persistent SQLite storage, FTS5 table management, HNSW persistence, RRF fusion, and document indexing |
| **Deterministic Embeddings** | `src/core/eosNeuralVectorCore.ts` (enhanced) / `src/core/eosHybridKnowledgeEngine.ts` | 64-dim dense projection, character n-gram hashing, and L2 normalization |
| **Full Corpus Indexer** | `src/core/eosHybridKnowledgeEngine.ts` | Incremental SHA-256 scanning of `openspec/specs/`, `openspec/changes/`, `docs/plans/`, and `src/**/*.ts` |
| **MCP Tool Integration** | `src/mcp/eosMcpServer.ts` & `api/mcp.js` | Upgraded `eos_semantic_search` tool handler with domain filtering and rich response formatting |
| **Verification Test Suite** | `test/eosHybridVectorKnowledge.test.mjs` | Verification of scenarios BDD-377 to BDD-381 |
| **Verification Receipt** | `docs/evidence/EVD-SPEC-141.json` | Epistemic audit receipt upon 7-stage gate passing |

---

## 3. Storage Schema Specification

```sql
-- 1. Document Metadata Table
CREATE TABLE IF NOT EXISTS eos_docs_metadata (
  doc_id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  category TEXT NOT NULL,       -- 'SPEC', 'CHANGE', 'ADR', 'CODE', 'PLAN', 'DOC'
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,   -- SHA-256 hex
  indexed_at_iso TEXT NOT NULL
);

-- 2. Full-Text Search (FTS5) Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS eos_docs_fts USING fts5(
  doc_id UNINDEXED,
  title,
  content,
  category,
  tokenize = 'unicode61'
);

-- 3. Dense Vector Embeddings Table
CREATE TABLE IF NOT EXISTS eos_vector_nodes (
  doc_id TEXT PRIMARY KEY,
  dimensions INTEGER NOT NULL,  -- 64
  vector_blob BLOB NOT NULL,    -- 64 * 4 = 256 bytes Float32Array raw buffer
  FOREIGN KEY (doc_id) REFERENCES eos_docs_metadata(doc_id) ON DELETE CASCADE
);

-- 4. HNSW Graph Topology Adjacency Table
CREATE TABLE IF NOT EXISTS eos_vector_edges (
  doc_id TEXT NOT NULL,
  layer INTEGER NOT NULL,
  neighbors_json TEXT NOT NULL, -- JSON array of neighbor doc_ids
  PRIMARY KEY (doc_id, layer)
);
```
