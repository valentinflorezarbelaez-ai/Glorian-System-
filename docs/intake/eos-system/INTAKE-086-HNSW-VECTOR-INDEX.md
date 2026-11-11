# INTAKE-086: Layer-0 Hierarchical Navigable Small World (HNSW) Vector Search Engine (SPEC-201)

- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Principal Architect & Owner)
- **Lifecycle Tier**: Core / Semantic Intelligence & Vector Retrieval
- **Context**: Autonomous Code Retrieval (RAG), Agent Memory & High-Dimensional Semantic Search

---

## 1. Problem Statement

Modern AI-assisted engineering and multi-agent coordination require semantic similarity search over codebases, architectural specifications, and execution traces. External vector databases (Pinecone, Qdrant, Milvus, Chroma) require cloud infrastructure, network connectivity, API credentials, and runtime dependencies, which violate sovereign air-gapped guarantees (Law V: zero external runtime dependencies).

Glorian requires an in-memory, deterministic, Layer-0 Hierarchical Navigable Small World (HNSW) vector search engine (`EosHnswVectorIndex`) providing sub-millisecond approximate nearest neighbor (ANN) search with cosine, Euclidean, and dot-product metrics, accompanied by a deterministic local code vectorizer.

---

## 2. Requirements & Scope

1. **HNSW Multi-Layer Graph**:
   - Probabilistic skip-list hierarchy ($l = \lfloor -\ln(\text{unif}(0, 1)) \cdot m_L \rfloor$).
   - Heuristic edge pruning with max degree $M$ and $M_{\max0} = 2M$.
   - Beam search priority queues governed by `efConstruction` and `efSearch`.
2. **High-Performance Distance Metrics**:
   - Cosine distance, Euclidean distance ($L_2$), and inner product using `Float32Array`.
3. **Autonomous Code Embedding Projection**:
   - Deterministic subword token hash projection generating normalized dense vectors without external embedding APIs.
4. **Serialization & Persistence**:
   - Deterministic JSON export/import of index graph structure and vectors.
5. **CLI & MCP Control Surfaces**:
   - CLI commands `glorian vector:index` and `glorian vector:search`.
   - MCP actions `vector_index` and `vector_search`.
