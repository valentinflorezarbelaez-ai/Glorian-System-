# SPEC-145: Repository Knowledge Graph & Relational Impact Engine

## 1. Specification Metadata
- **Specification ID**: `SPEC-145`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-030`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`, `SPEC-141`, `SPEC-142`, `SPEC-143`, `SPEC-144`
- **Architectural Decisions**:
  - `ADR-0184`: Directed Property Graph Schema in SQLite WAL Tables (`eos_kg_nodes`, `eos_kg_edges`)
  - `ADR-0185`: Deterministic AST & Markdown Extractor for Architectural Relational Triples
  - `ADR-0186`: Recursive CTE Transitive Reachability & Blast Radius Computation
- **Module Target**: `src/core/eosKnowledgeGraphEngine.ts`, `src/mcp/eosMcpServer.ts`, `test/eosKnowledgeGraphEngine.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-427 (Ubiquitous / Permanent — Directed Property Graph Storage in SQLite WAL)**:
  `THE SYSTEM SHALL persist a directed property graph in an isolated, durable SQLite WAL database at data/eos_knowledge_graph.db using tables eos_kg_nodes and eos_kg_edges with composite primary keys, foreign-key relational integrity, and B-Tree indexes on source, target, and edge relation types.`

- **FR-428 (Event-Driven — Multi-Source Architectural Entity Extraction and Ingestion)**:
  `WHEN an indexing cycle is triggered via syncGraph(), THE SYSTEM SHALL deterministically parse openspec/specs, openspec/changes, docs/plans, test suites, and src source modules, extracting nodes of types SPEC, CHANGE, PLAN, ADR, BDD, MODULE, and EVIDENCE along with directed edges representing IMPLEMENTS, VERIFIES, DECIDED_BY, MODIFIES, DEPENDS_ON, and SUPERSEDES relations.`

- **FR-429 (Ubiquitous / Permanent — Blast Radius & Transitive Reachability Computation)**:
  `THE SYSTEM SHALL compute the downstream impact or upstream causality of any known node up to a bounded depth (default: 4 hops, maximum: 10) by visiting each node at most once, returning hop distance and one directed path. SPEC-151 retires the path-materializing WITH RECURSIVE expansion because INSTRUMENTS and COVERED_BY hubs made that expansion exceed the BDD-406 allowance.`

- **FR-430 (State-Driven — Architectural Orphan & Relational Drift Detection)**:
  `WHILE auditing structural coherence via findOrphans(), THE SYSTEM SHALL identify and report any specifications lacking BDD scenarios, any test scenarios lacking specification references, and any core source modules unanchored to active specifications or ADRs.`

- **FR-431 (Event-Driven — MCP Knowledge Graph Query Dispatch)**:
  `WHEN an agent invokes eos_query_knowledge_graph with action stats, neighbors, blast_radius, find_orphans, or subgraph, THE SYSTEM SHALL execute the requested graph operation, returning structured JSON containing nodes, edges, path topologies, or aggregate graph metrics.`

- **FR-432 (Ubiquitous / Permanent — Graph Cryptographic Topology Sealing via SHA-256)**:
  `THE SYSTEM SHALL compute and record an immutable 64-character SHA-256 topological receipt over the canonical ordered serialization of all nodes and edges upon each graph synchronization cycle.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-404 Ingesta Determinista de Entidades Arquitectónicas Centrales (Nodos)
  GIVEN el repositorio de Glorian System con 144 especificaciones OpenSpec, cambios y módulos fuente
  WHEN se ejecuta EosKnowledgeGraphEngine.syncGraph()
  THEN el grafo crea nodos tipados para SPEC, CHANGE, PLAN, ADR, BDD y MODULE
  AND el total de nodos supera las 300 entidades con identificadores unívocos normalizados
  AND cada nodo contiene su metadata JSON, título, archivo de origen y hash SHA-256

SCENARIO: BDD-405 Resolución Precisa de Aristas Relacionales Fuertes
  GIVEN un grafo sincronizado a partir del código y la documentación
  WHEN se consultan las aristas salientes de una especificación reciente (como SPEC-144)
  THEN el grafo contiene aristas dirigidas DECIDED_BY hacia ADR-0181, ADR-0182 y ADR-0183
  AND contiene aristas IMPLEMENTS hacia src/mcp/eosMcpStreamServer.ts y src/core/eosWasmSandboxEngine.ts
  AND contiene aristas VERIFIES provenientes de test/eosStreamWasmHardening.test.mjs

SCENARIO: BDD-406 Cálculo Recursivo de Blast Radius Transitivo en Sub-5ms
  GIVEN el módulo de código fuente "src/mcp/eosMcpStreamServer.ts"
  WHEN se invoca computeBlastRadius("src/mcp/eosMcpStreamServer.ts", { maxDepth: 4 })
  THEN the engine returns every node reached by a single-visit walk
  AND the response includes hop distance and a directed path
  AND the best of two measurements stays within the 150ms allowance in BDD-406's executable test

SCENARIO: BDD-407 Detección a Prueba de Fallos de Nodos Huérfanos y Deriva
  GIVEN el grafo completo del repositorio
  WHEN se ejecuta findOrphans()
  THEN el sistema reporta la tasa de cobertura de especificaciones con escenarios BDD (100%)
  AND identifica cualquier entidad con grado cero o referencia rota sin arrojar excepciones no controladas

SCENARIO: BDD-408 Despacho Universal de Herramienta MCP (eos_query_knowledge_graph)
  GIVEN el servidor MCP local autenticado
  WHEN un agente cliente invoca eos_query_knowledge_graph con action: "stats"
  THEN el servidor retorna el recuento tipado de nodos, recuento de aristas y densidad del grafo
  WHEN se invoca con action: "blast_radius" y target: "SPEC-144"
  THEN el servidor retorna el subgrafo transitivo de impacto con nodos y aristas estructuradas

SCENARIO: BDD-409 Persistencia Durable en SQLite WAL y Sellado Criptográfico
  GIVEN una sincronización completa del grafo de conocimiento
  WHEN se inspecciona el archivo "data/eos_knowledge_graph.db"
  THEN el modo de registro de la base de datos es "WAL" (Write-Ahead Logging)
  AND el motor genera un recibo de topología "graphSha256" determinista de 64 caracteres hexadecimales
```
