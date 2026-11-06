# PLAN-151: Relational Closure on the Repository Knowledge Graph

## ADR-0187: Project SQLite edges into the existing cyclotron

- **Context**: `EosKnowledgeGraphEngine` and `EosOntologyCyclotron` both walk directed edges. Only the SQLite engine is filled from the repository.
- **Decision**: After a successful `syncGraph()` commit, copy node identifiers and edge triples into a fresh `EosOntologyCyclotron`. `computeMemoryClosure` reads that index and returns `executionUs` from `hrtime.bigint()`.
- **Rejected alternative**: A second on-disk graph. The SQLite database remains the durable store.
- **Rejected alternative**: A claimed sub-10-microsecond budget on the full repository graph. The published budget is 1000 microseconds for a closure of at most 64 nodes after one warmup.

## ADR-0188: INSTRUMENTS and COVERED_BY are extracted, not hand-curated

- **Context**: Agents need specification-to-tool and artifact-to-test edges.
- **Decision**: `INSTRUMENTS` is emitted only when a specification cites a tool name that `src/mcp/eosMcpServer.ts` declares with `name: "eos_..."`. `COVERED_BY` runs from a cited specification, or from an imported `src/` or `api/` module, toward the test file. Unknown blast-radius and memory-closure targets throw `Unknown knowledge graph node: ...`.
- **Rejected alternative**: Treating every `eos_*` token as a tool. Tokens that are not declared tool names do not become nodes.

## Consequences

Layer-0 imports stay inside `src/core` and `src/mcp`. `package.json` gains no runtime dependency. This plan does not add a network Raft transport.
