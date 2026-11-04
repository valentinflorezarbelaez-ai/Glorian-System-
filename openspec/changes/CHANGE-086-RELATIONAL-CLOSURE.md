# CHANGE-086: Relational Closure on the Repository Knowledge Graph

- **Change ID**: `CHANGE-086`
- **Specification ID**: `SPEC-151`
- **Status**: `IN_PROGRESS`
- **Authorization Level**: `LEVEL_3_PRODUCTION_AUTHORIZED`
- **Impacted Specifications**: `SPEC-151-RELATIONAL-CLOSURE.md`, `SPEC-145-REPOSITORY-KNOWLEDGE-GRAPH.md`
- **Modules Added / Modified**:
  - `src/core/eosKnowledgeGraphEngine.ts`
  - `src/mcp/eosMcpServer.ts`
  - `test/eosKnowledgeGraphEngine.test.mjs`
  - `docs/contracts/mcp-tool-catalog.json`
  - `docs/formal/RelationalClosure.tla`
  - `scripts/verify-formal-tla.mjs`

## Intent

Project the SPEC-145 SQLite graph into the in-memory ontology cyclotron, add `INSTRUMENTS` and `COVERED_BY` edges, report closure time in microseconds, and reject unknown blast-radius targets. Scope stays on one process. Multi-host quorum and hot Rust-to-Wasm compilation stay outside this change.
