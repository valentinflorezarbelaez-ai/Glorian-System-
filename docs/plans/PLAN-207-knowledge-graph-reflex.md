# PLAN-207: Closed-Loop Knowledge Graph & Semantic Reflex Engine (`SPEC-345`)

- **Change ID**: `CHANGE-207`
- **Spec ID**: `SPEC-345`
- **Status**: `PLAN_APPROVED`
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 1. Architectural Strategy & ADRs

### ADR-207-001: Pure Layer-0 In-Memory Adjacency Structures vs External Graph Databases

- **Context**: Autonomous intelligence in Glorian System requires sub-millisecond dependency graph analysis, blast-radius calculation, and topological sorting during agent reasoning and pre-commit checks.
- **Decision**: Implement a pure TypeScript in-memory bidirectional adjacency graph (forward and backward edge indices) with zero npm dependencies (`dependencies: {}`). Provide lossless JSON-LD / GraphML export and cryptographic state hashing.
- **Alternatives Rejected**:
  - Neo4j / Memgraph / Gremlin: Rejected due to heavy background daemon requirements, network overhead, and violation of local sovereign execution.
  - Graphlib / Cytoscape npm packages: Rejected to preserve strict Layer-0 zero-dependency constitutional purity.
- **Consequences**: Instantaneous in-process execution ($< 10$ms for 10,000 edges), zero dependencies, complete determinism.

### ADR-207-002: Tarjan's SCC and Kahn's Topological Algorithms with Deterministic Termination

- **Context**: Codebase architecture graphs frequently contain subtle circular references. The engine must accurately identify all cycles and determine execution order for valid DAGs.
- **Decision**: Implement Tarjan's Strongly Connected Components algorithm ($O(V+E)$) for cycle detection and Kahn's in-degree algorithm for topological DAG sorting.
- **Consequences**: Provably optimal computational complexity with exact cycle path identification.

### ADR-207-003: Bounded Reactive Reflex Dispatch Cascade ($\le 10$ Depth)

- **Context**: Reactive reflex hooks triggered on node/edge mutations can trigger secondary events that might cycle infinitely if uncontrolled.
- **Decision**: Include a monotonic cascade counter and depth lineage on every dispatched reflex event. If the depth exceeds 10 hops, the cascade aborts fail-safe with a circuit breaker alert.
- **Consequences**: Guarantees finite execution and eliminates event storm hazards.

---

## 2. Component Design & Interfaces

- `src/core/eosKnowledgeGraphReflex.types.ts`:
  - `NodeType`: `'SPECIFICATION' | 'INVARIANT' | 'FILE' | 'FLEET_REPO' | 'DECISION' | 'FINDING' | 'CONCEPT'`
  - `EdgeType`: `'GOVERNS' | 'DEPENDS_ON' | 'PRESERVES' | 'RESOLVES' | 'MUTATES' | 'VIOLATES'`
  - `GraphNode`: `id`, `type`, `label`, `properties`, `createdAt`, `updatedAt`
  - `GraphEdge`: `id`, `source`, `target`, `type`, `weight`, `properties`
  - `BlastRadiusReport`: `rootId`, `direction`, `maxDepth`, `impactedNodes`, `severityScore`
  - `CycleDetectionReport`: `hasCycles`, `cycleCount`, `cycles` (node ID arrays)
  - `TopologicalSortReport`: `isDag`, `orderedNodeIds`, `unresolvedCount`
  - `PageRankReport`: `ranks`, `iterations`, `dampingFactor`, `convergenceDelta`
  - `ReflexAction`: `id`, `triggerEntityId`, `eventType`, `actionPayload`, `depth`
  - `KnowledgeGraphAuditReceipt`: `spec`, `timestamp`, `nodeCount`, `edgeCount`, `cyclesDetected`, `topologicalSortValid`, `blastRadiusVerified`, `reflexCascadeBounded`, `allPassed`, `sha256`

- `src/core/eosKnowledgeGraphReflex.ts`:
  - `createKnowledgeGraph(): EosKnowledgeGraph`
  - `addNode(graph, node): void`
  - `addEdge(graph, edge): void`
  - `removeNode(graph, id): void`
  - `removeEdge(graph, id): void`
  - `findCycles(graph): CycleDetectionReport` (Tarjan's SCC)
  - `topologicalSort(graph): TopologicalSortReport` (Kahn's algorithm)
  - `computeBlastRadius(graph, rootId, options?): BlastRadiusReport`
  - `computePageRank(graph, options?): PageRankReport`
  - `registerReflexHook(graph, triggerType, handler): void`
  - `dispatchReflex(graph, event): ReflexAction[]` (bounded $\le 10$)
  - `auditKnowledgeGraphReflex(root?: string): KnowledgeGraphAuditReceipt`
