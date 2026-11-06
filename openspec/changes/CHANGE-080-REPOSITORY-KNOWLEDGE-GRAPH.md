# CHANGE-080: Repository Knowledge Graph & Relational Impact Engine

## 1. Change Metadata
- **Change ID**: `CHANGE-080`
- **Specification ID**: `SPEC-145`
- **Status**: `PROPOSED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-030`, `SPEC-096`, `SPEC-138`, `SPEC-139`, `SPEC-140`, `SPEC-141`, `SPEC-142`, `SPEC-143`, `SPEC-144`
- **Related Decisions**: `ADR-0184`, `ADR-0185`, `ADR-0186`
- **Target Files**:
  - `src/core/eosKnowledgeGraphEngine.ts`
  - `src/mcp/eosMcpServer.ts`
  - `docs/contracts/mcp-tool-catalog.json`
  - `test/eosKnowledgeGraphEngine.test.mjs`

---

## 2. Intent & Scope

### Intent
Inaugurate Horizon 3 Cognitive Elevation by transitioning Glorian System from textual/keyword retrieval to deep architectural relational intelligence:
1. Materialize a directed property graph of the entire repository inside a durable SQLite database (`data/eos_knowledge_graph.db`).
2. Establish formal typed nodes (`SPEC`, `CHANGE`, `PLAN`, `ADR`, `BDD`, `MODULE`, `EVIDENCE`) and directed relational edges (`IMPLEMENTS`, `VERIFIES`, `DECIDED_BY`, `MODIFIES`, `DEPENDS_ON`, `SUPERSEDES`).
3. Provide sub-5ms recursive blast radius and impact analysis for code mutations, allowing autonomous agents to understand exactly what tests and specs are touched by any file edit.
4. Detect structural architectural drift and orphan entities automatically.
5. Expose the knowledge graph through the universal MCP tool `eos_query_knowledge_graph`.

### Scope
- Implement `EosKnowledgeGraphEngine` with pure Layer-0 SQLite persistence.
- Provide extractors for OpenSpecs, Plans/ADRs, Test BDDs, and TypeScript source modules.
- Implement recursive CTE graph traversal for blast radius calculation.
- Register and dispatch MCP tool `eos_query_knowledge_graph`.
- Author verification suite `test/eosKnowledgeGraphEngine.test.mjs` validating `BDD-404` to `BDD-409`.
