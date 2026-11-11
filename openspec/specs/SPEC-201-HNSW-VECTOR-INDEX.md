# SPEC-201: Layer-0 Hierarchical Navigable Small World (HNSW) Vector Search Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Core / Semantic Intelligence & Vector Retrieval
- **Standard**: IEEE TPAMI (Malkov & Yashunin, 2018) / ISO/IEC 2382-37
- **Module**: `src/core/eosHnswVectorIndex.ts`

---

## 1. Context and Rationale

In high-concurrency, air-gapped, or sovereign engineering environments, relying on external cloud vector databases creates latency bottlenecks, credential overhead, and network vulnerabilities.

`EosHnswVectorIndex` provides an in-memory, zero-dependency Hierarchical Navigable Small World (HNSW) vector search engine that enables sub-millisecond semantic code search, retrieval-augmented verification (RAG), and agent memory indexing with deterministic distance calculations (Cosine, Euclidean, Dot Product) and autonomous code embedding projection.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1024 (Ubiquitous - Multi-Layer HNSW Graph Construction)**: `THE SYSTEM SHALL maintain a multi-layer proximity graph where nodes are inserted probabilistically across layers with heuristic edge pruning up to degree M.`

- **FR-1025 (Ubiquitous - Sub-Millisecond Nearest Neighbor Search)**: `WHEN search is invoked with a query vector, THE SYSTEM SHALL execute greedy layer traversal from entry point down to layer 0, returning the top-k nearest neighbors sorted by similarity score.`

- **FR-1026 (Ubiquitous - Zero-Dependency Code Embedding Projection)**: `THE SYSTEM SHALL project arbitrary code snippets or search queries into dense, normalized d-dimensional embedding vectors using deterministic subword token hashing.`

- **FR-1027 (Event-Driven - Deterministic State Serialization)**: `THE SYSTEM SHALL serialize the entire HNSW index (graph topology, node vectors, and metadata) to JSON and reconstruct the identical index via deserialize.`

- **FR-1028 (Ubiquitous - Cryptographic Receipt Generation)**: `THE SYSTEM SHALL emit a tamper-evident SHA-256 receipt certifying index size, dimensions, distance metric, and search results.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1024 Multi-layer HNSW graph vector insertion
  GIVEN an initialized HNSW vector index with dimension D
  WHEN vectors are inserted into the index
  THEN multi-layer graph edges are established according to parameters M and efConstruction
  AND the total node count reflects the inserted elements

SCENARIO: BDD-1025 Approximate nearest neighbor search accuracy
  GIVEN an indexed collection of known high-dimensional vectors
  WHEN search is executed with a target vector and k = 3
  THEN the top-3 closest vectors are returned
  AND the nearest neighbor distance is approximately 0 for an exact query match

SCENARIO: BDD-1026 Autonomous code embedding projection and semantic retrieval
  GIVEN code snippets covering distinct algorithmic domains (e.g. sorting vs hashing vs cryptography)
  WHEN indexCodeSnippet and searchCode are executed
  THEN semantic queries retrieve the conceptually relevant code snippets with score > 0.8

SCENARIO: BDD-1027 Deterministic index serialization and restoration
  GIVEN an active HNSW index populated with vectors
  WHEN serialize is executed, followed by deserialize
  THEN the reconstructed index produces identical search results and distance scores

SCENARIO: BDD-1028 CLI invocation and cryptographic receipt
  GIVEN the Glorian CLI
  WHEN glorian vector:search "crypto" --json is executed
  THEN a valid JSON report containing query, matches, and sha256Receipt is emitted
```

---

## 4. Architectural Invariants

1. **Law I (Zero Vibe Coding)**: Graph construction and beam search traversals are strictly deterministic.
2. **Law V (Zero Runtime Dependencies)**: Pure TypeScript using `Float32Array` buffers with zero external libraries.
3. **Law VII (Layer-0 Isolation)**: Memory is safely bound by preconfigured maximum element capacities.
