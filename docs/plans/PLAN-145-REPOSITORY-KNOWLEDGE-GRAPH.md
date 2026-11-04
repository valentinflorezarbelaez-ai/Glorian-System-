# PLAN-145: Repository Knowledge Graph & Relational Impact Engine

## 1. Architectural Decision Records (ADRs)

### ADR-0184: Directed Property Graph Schema in SQLite WAL Tables
- **Context**: Autonomous agents currently navigate the repository using unstructured text files or simple flat search indexes (FTS5). Navigating from a code file back to its governing ADRs or calculating the downstream impact of an edited function requires multi-file grepping or heuristic guessing. We need a performant, relational property graph engine that adheres strictly to Layer-0 purity (`runtimeDependenciesCount: 0`).
- **Decision**:
  1. Store nodes in `eos_kg_nodes`:
     ```sql
     CREATE TABLE IF NOT EXISTS eos_kg_nodes (
       id TEXT PRIMARY KEY,
       type TEXT NOT NULL,
       title TEXT NOT NULL,
       file TEXT NOT NULL,
       metadata TEXT,
       sha256 TEXT NOT NULL,
       updated_at INTEGER NOT NULL
     );
     CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON eos_kg_nodes(type);
     ```
  2. Store directed edges in `eos_kg_edges`:
     ```sql
     CREATE TABLE IF NOT EXISTS eos_kg_edges (
       source_id TEXT NOT NULL,
       target_id TEXT NOT NULL,
       relation TEXT NOT NULL,
       weight REAL DEFAULT 1.0,
       metadata TEXT,
       created_at INTEGER NOT NULL,
       PRIMARY KEY (source_id, target_id, relation),
       FOREIGN KEY (source_id) REFERENCES eos_kg_nodes(id) ON DELETE CASCADE,
       FOREIGN KEY (target_id) REFERENCES eos_kg_nodes(id) ON DELETE CASCADE
     );
     CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON eos_kg_edges(source_id);
     CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON eos_kg_edges(target_id);
     CREATE INDEX IF NOT EXISTS idx_kg_edges_relation ON eos_kg_edges(relation);
     ```
  3. Operate in `PRAGMA journal_mode = WAL` and `PRAGMA synchronous = NORMAL` for durable, high-throughput ACID transactions.
- **Rejected Alternatives**:
  - *Embedded In-Memory Graph Library (Graphology / Cytoscape)*: Violates Layer-0 purity by adding external npm dependencies.
  - *Static JSON Graph Dump*: Does not support fast indexed adjacency queries, foreign key enforcement, or sub-5ms recursive reachability traversals.
- **Consequences**: Zero third-party dependencies; high-speed B-Tree queries; native persistence in `data/eos_knowledge_graph.db`.

### ADR-0185: Deterministic AST & Markdown Extractor for Architectural Relational Triples
- **Context**: The graph must be continuously populated from actual files on disk without manual curation.
- **Decision**:
  Implement a deterministic parser scanning:
  1. `openspec/specs/SPEC-*.md`: Extracts metadata (`SPEC-XXX`), related specs (`DEPENDS_ON`), architectural decisions (`DECIDED_BY`), and target module headers (`IMPLEMENTS`).
  2. `openspec/changes/CHANGE-*.md`: Extracts change proposals (`CHANGE-XXX`), modified specs, and files (`MODIFIES`).
  3. `docs/plans/PLAN-*.md`: Extracts ADR headers (`ADR-XXX`) and rejected alternatives.
  4. `test/*.test.mjs`: Scans `BDD-XXX` scenario declarations and imports to create `VERIFIES` edges.
  5. `src/**/*.ts`: Identifies module files, exported classes/functions, and relative imports.
- **Consequences**: Single source of truth. Every spec edit automatically syncs the relational graph topology.

### ADR-0186: Recursive CTE Transitive Reachability & Blast Radius Computation
- **Context**: When an agent edits or inspects a source module or specification, it must know the exact transitive reachability graph within a bounded search depth.
- **Decision**:
  Utilize SQLite's native `WITH RECURSIVE` engine:
  ```sql
  WITH RECURSIVE reach(node_id, depth, path) AS (
    SELECT id, 0, id FROM eos_kg_nodes WHERE id = ?
    UNION
    SELECT e.target_id, r.depth + 1, r.path || ' -> ' || e.relation || ' -> ' || e.target_id
    FROM reach r
    JOIN eos_kg_edges e ON r.node_id = e.source_id
    WHERE r.depth < ? AND r.path NOT LIKE '%' || e.target_id || '%'
  )
  SELECT DISTINCT n.*, r.depth, r.path
  FROM reach r
  JOIN eos_kg_nodes n ON r.node_id = n.id
  ORDER BY r.depth ASC;
  ```
- **Consequences**: Blazing-fast traversal (sub-5ms) with automatic cycle detection preventing infinite recursion loops.

---

## 2. Component Architecture

```text
[Disk Artifacts]
openspec/specs/      --> [EosKnowledgeGraphEngine.syncGraph()]
openspec/changes/           |
docs/plans/                 +---> Ingest Nodes & Edges
test/*.test.mjs             |
src/**/*.ts                 v
                [SQLite WAL: data/eos_knowledge_graph.db]
                            |
           +----------------+----------------+
           |                                 |
           v                                 v
[computeBlastRadius()]              [findOrphans()]
           |                                 |
           +----------------+----------------+
                            |
                            v
               [eos_query_knowledge_graph]
               (Exposed to Antigravity & Agents)
```
