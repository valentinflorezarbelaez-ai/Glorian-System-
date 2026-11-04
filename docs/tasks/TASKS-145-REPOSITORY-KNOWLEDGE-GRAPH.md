# TASKS-145: Atomic Task DAG — Repository Knowledge Graph & Relational Impact Engine

## Task DAG
```text
Task 1: Implement Core Graph Storage & SQLite WAL Schema (src/core/eosKnowledgeGraphEngine.ts)
  ↳ Task 2: Implement Multi-Source Ingestion & Relational Triple Extractors (src/core/eosKnowledgeGraphEngine.ts)
    ↳ Task 3: Implement Recursive CTE Blast Radius & Orphan Detection Algorithms (src/core/eosKnowledgeGraphEngine.ts)
      ↳ Task 4: Expose Universal MCP Tool eos_query_knowledge_graph (src/mcp/eosMcpServer.ts)
        ↳ Task 5: Author Dedicated Verification Suite test/eosKnowledgeGraphEngine.test.mjs (BDD-404 to BDD-409)
          ↳ Task 6: Record Level 3 Implementation Authorization (IMPLEMENTATION_AUTHORIZATION.md)
            ↳ Task 7: Synchronize OpenSpec Catalog (145 Specs), Regenerate SBOM/Provenance & Commit to origin/main
```

---

### Task 1: Implement Core Graph Storage & SQLite WAL Schema
- **Goal**:
  - Implement `EosKnowledgeGraphEngine` with native `node:sqlite` in WAL mode.
  - Create tables `eos_kg_nodes` and `eos_kg_edges` with foreign keys and compound indexes.
  - Add node and edge CRUD methods with prepared statements.
- **Done Criteria**: Passing unit tests verifying database initialization and index creation.

### Task 2: Implement Multi-Source Ingestion & Relational Triple Extractors
- **Goal**:
  - Ingest `openspec/specs/` (`SPEC` nodes, `DEPENDS_ON`, `DECIDED_BY`, `IMPLEMENTS`).
  - Ingest `openspec/changes/` (`CHANGE` nodes, `MODIFIES`).
  - Ingest `docs/plans/` (`ADR` nodes).
  - Ingest `test/` (`BDD` nodes, `VERIFIES`).
  - Ingest `src/` (`MODULE` nodes).
- **Done Criteria**: Ingestion extracts > 300 nodes and > 500 edges with clean foreign key integrity.

### Task 3: Implement Recursive CTE Blast Radius & Orphan Detection Algorithms
- **Goal**:
  - Implement `computeBlastRadius(nodeId, options)` using recursive CTEs with cycle prevention.
  - Implement `findOrphans()` identifying unanchored specs, BDDs, or modules.
  - Implement `getNeighbors(nodeId, direction)` and `getGraphStats()`.
- **Done Criteria**: Query latency < 5ms for blast radius up to 5 hops.

### Task 4: Expose Universal MCP Tool `eos_query_knowledge_graph`
- **Goal**:
  - Add `eos_query_knowledge_graph` to `EosMcpServer` handling actions `stats`, `neighbors`, `blast_radius`, `find_orphans`, `subgraph`.
  - Update `docs/contracts/mcp-tool-catalog.json`.
- **Done Criteria**: MCP `tools/call` executes query and returns structured JSON results.

### Task 5: Author Dedicated Verification Suite `test/eosKnowledgeGraphEngine.test.mjs`
- **Goal**: Implement BDD tests for `BDD-404` through `BDD-409`.
- **Done Criteria**: `node --test test/eosKnowledgeGraphEngine.test.mjs` exits with code 0.

### Task 6: Record Level 3 Implementation Authorization
- **Goal**: Update `IMPLEMENTATION_AUTHORIZATION.md` with milestone `SPEC-145 / CHANGE-080` and authorization record `AUTH-2026-11-04-REPOSITORY-KNOWLEDGE-GRAPH-145`.
- **Done Criteria**: Level 3 documentation committed.

### Task 7: Synchronize OpenSpec Catalog, Regenerate SBOM/Provenance & Commit to origin/main
- **Goal**: Export catalog index (145 specs), update `AGENTS.md`, run `npm run sbom:generate`, verify 7 stages with `verify:strict`, commit and push to `origin/main`.
- **Done Criteria**: Clean exit code 0; remote CI run succeeds.
