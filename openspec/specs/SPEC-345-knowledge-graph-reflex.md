# SPEC-345: Closed-Loop Knowledge Graph & Semantic Reflex Engine

**Status**: `APPROVED`

## 0. Intent

Modern agentic ecosystems require a living, bitemporal semantic knowledge graph connecting specifications, invariants, source files, fleet repositories, architectural decisions, and findings. When any graph entity mutates, the system must deterministically detect circular dependencies, compute topological DAG schedules, calculate blast radii, and dispatch bounded semantic reflex hooks. This specification defines an autonomous, pure Layer-0 Knowledge Graph and Semantic Reflex Engine (`EosKnowledgeGraphReflexCore`) that guarantees cycle-free execution DAGs, bounded reflex propagation, and topological certainty.

Doctrine: **Law I (Specification as Supreme Truth)**, **Law III (Evidence Over Claims)**, and **Law V (Architectural Purity)**.

---

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO nodes (`SPECIFICATION`, `INVARIANT`, `FILE`, `FLEET_REPO`, `DECISION`, `FINDING`, `CONCEPT`) and directional typed edges (`GOVERNS`, `DEPENDS_ON`, `PRESERVES`, `RESOLVES`, `MUTATES`, `VIOLATES`) are added, updated, or removed, EL SISTEMA updates the bitemporal adjacency graph and logs an immutable transition event with monotonic sequence numbers.
- **FR-2 (Event-Driven)**: CUANDO circular dependencies or recursive references are evaluated, EL SISTEMA executes Tarjan's Strongly Connected Components (SCC) algorithm in $O(V+E)$ time, identifies any component containing a cycle, and reports exact cycle member sequences.
- **FR-3 (State-Driven)**: MIENTRAS calculating dependency execution order for DAG entities, EL SISTEMA applies Kahn's algorithm for deterministic topological sorting, emitting an ordered execution sequence or failing fast if a cycle is present.
- **FR-4 (Event-Driven)**: CUANDO evaluating the impact of an entity change, EL SISTEMA traverses the directed graph to compute the Blast Radius within a configurable maximum hop depth, returning all affected downstream and upstream nodes.
- **FR-5 (Error / Unwanted Condition)**: SI a node or edge mutation triggers reactive reflex hooks, ENTONCES EL SISTEMA executes the reflex cascade with a strict depth ceiling $\le 10$, preventing infinite cascade storms and isolating recurring events fail-safe.
- **FR-6 (Ubiquitous)**: EL SISTEMA computes PageRank / eigenvector centrality across all nodes using deterministic power iteration, identifying architectural bottlenecks and core hub entities.
- **FR-7 (Event-Driven)**: CUANDO `auditKnowledgeGraphReflex()` executes, EL SISTEMA verifies cycle detection, topological sorting, blast radius accuracy, reflex dispatch boundedness, and emits a cryptographic evidence receipt to `docs/evidence/KNOWLEDGE_GRAPH_REFLEX_RECEIPT.json`.
- **FR-8 (Ubiquitous)**: EL SISTEMA exposes CLI commands `toolchain:graph:query`, `toolchain:graph:blast-radius`, `toolchain:graph:cycles`, `toolchain:graph:pagerank`, `toolchain:graph:reflex`, and `toolchain:graph:audit` with clean `--json` machine contracts.

---

## 2. Non-Functional Requirements

- **NFR-1**: 100% pure Layer-0 implementation (`dependencies: {}` in `package.json`). Zero external graph databases or libraries.
- **NFR-2**: All touched and newly created modules must strictly conform to $\le 800$ lines with $\ge 12$ lines of headroom (SPEC-250).
- **NFR-3**: Graph traversal and SCC detection must process $\ge 10,000$ edges in $< 10$ milliseconds on single-core V8.
- **NFR-4**: Reflex cascade recursion depth must be strictly bounded to $\le 10$ iterations.

---

## 3. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1849 Bitemporal Property Graph Entity and Edge Creation
  DADO an empty knowledge graph
  CUANDO addNode and addEdge execute with valid typed properties
  ENTONCES the entities and relationships are stored in adjacency structures
  Y an immutable bitemporal transaction is logged with a SHA-256 state hash.

ESCENARIO: BDD-1850 Cycle Detection via Tarjan's Strongly Connected Components
  DADO a knowledge graph containing a circular dependency loop (A -> B -> C -> A)
  CUANDO findCycles executes
  ENTONCES Tarjan's SCC algorithm identifies the exact cycle path
  Y flags the graph as non-DAG.

ESCENARIO: BDD-1851 Kahn's Topological Sorting of Architectural DAGs
  DADO an acyclic directed graph of tasks and specifications
  CUANDO topologicalSort executes
  ENTONCES a valid linear ordering is returned where every dependency precedes its dependent
  Y the sort terminates deterministically in O(V+E) time.

ESCENARIO: BDD-1852 Deterministic Blast Radius Computation
  DADO an entity in a deep dependency hierarchy
  CUANDO computeBlastRadius executes with maxDepth=3
  ENTONCES all downstream impacted entities and upstream governing entities are identified
  Y the blast radius severity score is calculated.

ESCENARIO: BDD-1853 Bounded Reactive Reflex Dispatch Cascade
  DADO a registered reflex trigger hook on entity mutation
  CUANDO a node mutation triggers secondary and tertiary reflex events
  ENTONCES the cascade dispatches reactively without infinite loops
  Y execution halts safely if the depth limit of 10 is reached.

ESCENARIO: BDD-1854 PageRank Centrality and Cryptographic Audit Receipt
  DADO a populated knowledge graph
  CUANDO computePageRank and auditKnowledgeGraphReflex execute
  ENTONCES architectural hub nodes are assigned highest centrality scores
  Y a verifiable SHA-256 evidence receipt is written to docs/evidence/KNOWLEDGE_GRAPH_REFLEX_RECEIPT.json.
```
