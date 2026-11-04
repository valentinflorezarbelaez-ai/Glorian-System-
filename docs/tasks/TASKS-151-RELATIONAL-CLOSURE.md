# TASKS-151: Relational Closure

1. Add `INSTRUMENTS` and `COVERED_BY` to the edge relation union and extract them during `syncGraph()`.
   Done when a synchronized graph contains `SPEC-151 -INSTRUMENTS-> mcp:eos_query_knowledge_graph` and `COVERED_BY` edges into `test/eosKnowledgeGraphEngine.test.mjs`.
2. Project committed nodes and edges into `EosOntologyCyclotron` and expose `computeMemoryClosure`.
   Done when the result reports `index: "memory-adjacency"` and a positive `executionUs`.
3. Reject unknown node identifiers from `computeBlastRadius` and `computeMemoryClosure`.
   Done when the error message contains `Unknown knowledge graph node`.
4. Dispatch MCP action `memory_closure` and record it in the tool catalog enum.
   Done when `tools/call` returns the closure for `SPEC-145` and a JSON-RPC error for `NO-SUCH-NODE`.
5. Add `RelationalClosure.tla` and a bounded JavaScript simulation. The simulation is not a TLC proof.
   Done when `verifyRelationalClosureModel()` is included in `runAllFormalVerifications()`.
6. Run `node --test test/eosKnowledgeGraphEngine.test.mjs` and `npm run typecheck`.
   Done when both commands exit 0.
