# CHANGE-076: Distributed Vector Memory & Hybrid Search Engine

## 1. Metadata
- **Change ID**: `CHANGE-076`
- **Spec Target**: `SPEC-141`
- **Related Specs**: `SPEC-038`, `SPEC-066`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`
- **Architectural Decisions**: `ADR-0174`, `ADR-0175`
- **State**: `PROPOSED`

---

## 2. Intent & Scope
1. **Implement `src/core/eosHybridKnowledgeEngine.ts`**:
   - High-performance, persistent hybrid search engine combining SQLite FTS5 (BM25 lexical scoring) and HNSW (Hierarchical Navigable Small World) dense vector graph indexing.
   - Store dense vector embeddings directly as binary `BLOB` fields (`Float32Array`) in native `node:sqlite` (`DatabaseSync`), with WAL mode and synchronous normal.
   - Persist graph topology (nodes, layers, edges) into `eos_vector_nodes` and `eos_vector_edges` tables, enabling instantaneous cold starts without full rebuilds.
   - Implement Reciprocal Rank Fusion (RRF with $k = 60$) fusing lexical and semantic ranks deterministically.
   - Sub-5ms query performance for top-K hybrid retrieval across hundreds of documents.

2. **Implement Deterministic Layer-0 Dense Embedding Generator**:
   - Pure TypeScript, zero-runtime-dependency 64-dimensional semantic projection using subword character n-grams (3-gram, 4-gram), Murmur/FNV-1a hash distribution, positional term frequency weighting, and L2 unit-sphere normalization.
   - Guarantee that identical text inputs generate identical byte-for-byte `Float32Array` embeddings across OS environments (Windows, Linux, macOS).

3. **Implement Full Corpus Incremental Indexer**:
   - Index all 140+ OpenSpecs (`openspec/specs/SPEC-*.md`), 83+ changes (`openspec/changes/CHANGE-*.md`), architecture plans, and TypeScript source files (`src/**/*.ts`).
   - Store SHA-256 content hashes per document; skip unchanged documents on subsequent runs with sub-15ms no-op latency.
   - Extract title, document category, tags, and section headers.

4. **Upgrade MCP Semantic Search Tool in `src/mcp/eosMcpServer.ts` and `api/mcp.js`**:
   - Connect `eos_semantic_search` to the live `EosHybridKnowledgeEngine`.
   - Support `mode: "hybrid" | "vector" | "lexical"`, `topK`, and `category` filters (`SPEC`, `CHANGE`, `CODE`, `ALL`).
   - Return rich structured responses including relevance score, file path, title, matched snippet, and domain tags.

5. **Author Verification Test Suite `test/eosHybridVectorKnowledge.test.mjs`**:
   - Verify scenarios BDD-377 through BDD-381.

---

## 3. Impact Assessment
- Zero changes to `package.json` runtime dependencies (`dependencies: {}` preserved).
- Full backwards compatibility with existing MCP clients invoking `eos_semantic_search`.
- SQLite storage is strictly localized to `.eos/state/` or in-memory (`:memory:`).
- Execution fully verified within the 7-stage CI/CD gate.
