# TASKS-141: Atomic Task DAG — Distributed Vector Memory & Hybrid Search Engine

## Task DAG
```text
Task 1: Architecture Invariant Check & Schema Validation
  ↳ Task 2: Implement EosHybridKnowledgeEngine (src/core/eosHybridKnowledgeEngine.ts)
    ↳ Task 3: Implement Incremental Corpus Scanner (Specs, Changes, ADRs, Code)
      ↳ Task 4: Upgrade MCP eos_semantic_search Tool (src/mcp/eosMcpServer.ts & api/mcp.js)
        ↳ Task 5: Author Test Suite test/eosHybridVectorKnowledge.test.mjs (BDD-377 to BDD-381)
          ↳ Task 6: Export OpenSpec Catalog Index (141 Specs at 100%)
            ↳ Task 7: Execute 7-Stage verify:strict, Record EVD-SPEC-141.json, Commit & Push
```

---

### Task 1: Architecture Invariant Check & Schema Validation
- **Goal**: Verify `node:sqlite` DatabaseSync features (WAL mode, FTS5 virtual tables, BLOB write/read) in clean test harness.
- **Done Criteria**: Scratch test executes with zero errors.

### Task 2: Implement `src/core/eosHybridKnowledgeEngine.ts`
- **Goal**: Implement the core hybrid knowledge engine:
  - SQLite persistent schema (`eos_docs_metadata`, `eos_docs_fts`, `eos_vector_nodes`, `eos_vector_edges`).
  - Deterministic 64-dimensional dense embedding generator (`Float32Array` unit-sphere projection).
  - HNSW graph index persistence and fast in-memory query execution.
  - Reciprocal Rank Fusion (RRF $k=60$) combining BM25 and Cosine similarity.
  - Sub-5ms search turnaround time.
- **Done Criteria**: Class exports clean interfaces and compiles with `tsc --noEmit`.

### Task 3: Implement Incremental Corpus Scanner
- **Goal**: Implement `indexCorpus(options)` method:
  - Scans `openspec/specs/`, `openspec/changes/`, `docs/plans/`, and `src/**/*.ts`.
  - Computes SHA-256 content hashes, skipping unchanged documents.
  - Sub-15ms overhead when corpus is unchanged.
- **Done Criteria**: Indexing 140+ OpenSpecs executes cleanly.

### Task 4: Upgrade MCP `eos_semantic_search` Tool
- **Goal**: Connect MCP handlers in `src/mcp/eosMcpServer.ts` and `api/mcp.js` to `EosHybridKnowledgeEngine`.
  - Expose `query`, `mode` (`hybrid`, `vector`, `lexical`), `topK`, `category` (`SPEC`, `CHANGE`, `CODE`, `ALL`).
  - Return rich snippets, citations, and scores.
- **Done Criteria**: Direct MCP invocation returns real matches from the indexed specs.

### Task 5: Author Test Suite `test/eosHybridVectorKnowledge.test.mjs`
- **Goal**: Implement automated BDD tests for scenarios BDD-377 to BDD-381.
- **Done Criteria**: `node --test test/eosHybridVectorKnowledge.test.mjs` exits with code 0.

### Task 6: Export OpenSpec Catalog Index
- **Goal**: Run catalog generation to include `SPEC-141` as `APPROVED`.
- **Done Criteria**: `docs/specs/openspec-catalog-index.json` reports 141 specs.

### Task 7: Strict Verification & Push
- **Goal**: Run `node scripts/verify-cicd-pipeline.mjs`, generate `docs/evidence/EVD-SPEC-141.json`, commit, and push to `origin/main`.
- **Done Criteria**: 7/7 verification stages pass with exit code 0.
