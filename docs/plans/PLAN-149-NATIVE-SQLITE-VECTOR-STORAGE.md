# PLAN-149: Native node:sqlite Storage, FTS5 Search & Quantized Vector Governor

- **Change ID**: `CHANGE-149`
- **Spec ID**: `SPEC-287`
- **Component**: `Glorian System Core / Embedded Storage & Semantic Retrieval`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`
- **Date**: 2026-11-15

---

## 1. Architectural Strategy & Design Patterns

### 1.1 Pure Built-in `node:sqlite` Architecture

Starting with Node.js 22.18+, the runtime bundles an official C SQLite build through the `node:sqlite` core module (`DatabaseSync`).
This unlocks:

1. Zero third-party npm dependencies (`better-sqlite3`, `sqlite3` are unnecessary).
2. Native FTS5 compilation enabled directly within Node's SQLite engine.
3. Synchronous execution without async Promise overhead for local microsecond transactions.

### 1.2 Schema Architecture

```sql
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  vector BLOB,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  content='documents',
  content_rowid='rowid'
);
```

### 1.3 Quantized Vector Search over BLOBs

Vectors are stored as scalar quantized 8-bit unsigned integers (`Uint8Array`) using scalar quantization SQ8 (`SPEC-283`):
$$\vec{v}_{\text{quantized}}[i] = \text{round}\left( 255 \times \frac{\vec{v}[i] - \min(\vec{v})}{\max(\vec{v}) - \min(\vec{v})} \right)$$
For query vector $\vec{q}$, inner products and cosine similarity are computed using unrolled loops directly against the raw binary Buffer returned by `node:sqlite`.

### 1.4 Reciprocal Rank Fusion (RRF)

Hybrid search combines lexical rank from FTS5 with vector similarity rank:
$$\text{RRF}(d) = \frac{1}{k + \text{rank}_{\text{fts}}(d)} + \frac{1}{k + \text{rank}_{\text{vec}}(d)}, \quad k = 60$$

---

## 2. Architecture Decision Records (ADR)

### ADR-149.1: Synchronous `DatabaseSync` vs Asynchronous SQLite

- **Context**: Embedded SQLite file access in a local CLI and serverless environment has microsecond latency. Asynchronous wrappers add event-loop tick overhead.
- **Decision**: Use `node:sqlite`'s `DatabaseSync` API directly.
- **Status**: ACCEPTED.
- **Consequences**: Deterministic sequential execution, zero microtask overhead, and straightforward transaction management with `db.exec('BEGIN TRANSACTION')`.

### ADR-149.2: Embedded Vector Search vs External Vector DB

- **Context**: External vector databases (Pinecone, Qdrant) require network hops and external infrastructure.
- **Decision**: Implement in-process vector cosine search over SQLite BLOBs for datasets under 100,000 documents.
- **Status**: ACCEPTED.
- **Consequences**: Sub-millisecond latency, zero external network calls, and 100% offline self-containment (Law V).
