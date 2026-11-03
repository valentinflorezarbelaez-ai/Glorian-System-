# SPEC-141: Distributed Vector Memory & Hybrid Search Engine (Big Tech Standard)

## 1. Specification Metadata
- **Specification ID**: `SPEC-141`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-038`, `SPEC-066`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`
- **Architectural Decisions**: `ADR-0174` (Hybrid Reciprocal Rank Fusion Architecture), `ADR-0175` (Layer-0 Pure Dense Vector Persistence in SQLite BLOBs)
- **Module Target**: `src/core/eosHybridKnowledgeEngine.ts`, `src/mcp/eosMcpServer.ts`, `api/mcp.js`, `test/eosHybridVectorKnowledge.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-01 (Ubiquitous / Permanent — Dual Persistent Schema & Zero Runtime Dependencies)**:
  `THE SYSTEM SHALL persist knowledge documents, FTS5 inverted text index, dense 64-dimensional Float32Array vector embeddings, and HNSW graph topology into a unified SQLite database using native node:sqlite DatabaseSync with WAL journal mode, requiring exactly 0 runtime npm dependencies.`

- **FR-02 (State-Driven / Deterministic Layer-0 Dense Embedding Projection)**:
  `WHILE generating vector embeddings for text chunks, THE SYSTEM SHALL compute a deterministic 64-dimensional dense Float32Array embedding using subword n-gram hashing and L2 unit-sphere normalization, guaranteeing identical bit-level output for identical text across all operating systems without calling external web APIs.`

- **FR-03 (Event-Driven / Reciprocal Rank Fusion Hybrid Retrieval)**:
  `WHEN an agent executes a hybrid search query with topK candidates, THE SYSTEM SHALL execute concurrent FTS5 BM25 lexical ranking and HNSW Cosine vector similarity ranking, and fuse both rankings using Reciprocal Rank Fusion (RRF) with constant k=60, returning ordered results in under 5 milliseconds.`

- **FR-04 (Event-Driven / Incremental Corpus Indexing with SHA-256 Content-Addressing)**:
  `WHEN indexing the documentation and source tree, THE SYSTEM SHALL compute the SHA-256 hash of each document, skipping unchanged documents and only updating SQLite records and vector graphs when content has mutated, completing a full no-op incremental scan in under 15 milliseconds.`

- **FR-05 (Error / Boundary Condition — Graceful Fallback on Ephemeral and Empty Queries)**:
  `IF a search query is empty, whitespace-only, or contains solely stopwords, THEN THE SYSTEM SHALL return an empty result array with status 200 without throwing errors; AND IF the underlying database file is read-only or in-memory, THE SYSTEM SHALL operate in volatile in-memory mode without persistence failures.`

- **FR-06 (Ubiquitous / Permanent — MCP Protocol Tool Integration)**:
  `THE SYSTEM SHALL expose the hybrid knowledge engine via the eos_semantic_search MCP tool in both local persistent daemon and Vercel serverless edge environments, supporting query, mode (hybrid, vector, lexical), category filtering (SPEC, CHANGE, CODE, ALL), and returning structured snippets, file citations, and scores.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-377 Inicialización Persistente y Modo WAL de SQLite Vectorial
  GIVEN una instancia de EosHybridKnowledgeEngine configurada en disco o memoria
  WHEN se inicializa el motor de conocimiento
  THEN se crean las tablas eos_docs_metadata, eos_docs_fts (FTS5 con unicode61), eos_vector_nodes y eos_vector_edges
  AND el journal_mode de SQLite se establece en WAL o MEMORY sin errores de driver nativo

SCENARIO: BDD-378 Proyección Determinista de Embeddings Vectoriales Layer-0
  GIVEN el generador de embeddings densos de 64 dimensiones sin dependencias externas
  WHEN se proyectan dos textos idénticos en momentos o entornos diferentes
  THEN los vectores Float32Array resultantes son idénticos bit a bit
  AND la norma euclidiana L2 del vector normalizado es igual a 1.0 (tolerancia 1e-5)
  AND dos textos con palabras similares obtienen una similitud de coseno significativamente mayor que dos textos no relacionados

SCENARIO: BDD-379 Recuperación Híbrida mediante Reciprocal Rank Fusion (RRF)
  GIVEN un corpus de prueba indexado con especificaciones y código
  WHEN un agente consulta un término exacto de especificación con intención conceptual en modo hybrid
  THEN el motor calcula el ranking léxico BM25 y el ranking vectorial de coseno
  AND combina las posiciones aplicando RRF con k=60
  AND el resultado prioritario contiene el documento más relevante en menos de 5 milisegundos

SCENARIO: BDD-380 Indexación Incremental con Atestación de Contenido SHA-256
  GIVEN un directorio con 140 OpenSpecs y archivos de código indexados previamente
  WHEN se ejecuta una re-indexación sin cambios en los archivos
  THEN el motor omite los 140 documentos basándose en la coincidencia del SHA-256
  AND la operación completa finaliza en menos de 15 milisegundos
  WHEN se modifica un archivo en el corpus
  THEN solo el documento mutado actualiza su FTS5 y su vector en la base de datos

SCENARIO: BDD-381 Integración y Exposición en Herramienta MCP eos_semantic_search
  GIVEN el servidor MCP de Glorian System en ejecución
  WHEN un cliente invoca la herramienta eos_semantic_search con query="streamable http transport", mode="hybrid", topK=5
  THEN el servidor responde con matchCount >= 1
  AND cada coincidencia incluye id, score, title, snippet, filePath y category
  AND la especificación SPEC-140 figura en los primeros resultados con alta relevancia
```
