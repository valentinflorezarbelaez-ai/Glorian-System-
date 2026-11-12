# TASKS-100: Layer-0 Conflict-Free Replicated Data Types (CRDT) Collaborative State Synchronization Engine DAG

## Task Checklist

- [ ] **TASK-100-1: Type Definitions & CRDT Contracts**
  - Create `src/core/eosCrdtStateSyncCore.types.ts`.
  - Define `VectorClock`, `LwwRegister<T>`, `OrSetElement<T>`, `OrSet<T>`, `RgaNode<T>`, `CrdtStateSnapshot`, `CrdtDelta`, `CrdtReceipt`.

- [ ] **TASK-100-2: Core CRDT State Sync Engine Implementation**
  - Implement `src/core/eosCrdtStateSyncCore.ts`.
  - Implement Causal Vector Clock logic (increment, merge, compare: `<=`, `>`, `concurrent`).
  - Implement LWW-Register and LWW-Map with deterministic timestamp + node ID tie-breaking.
  - Implement ORSet (Observed-Remove Set) with unique tags and tombstone-free element queries.
  - Implement RGA (Replicated Growable Array) for sequential text/list collaborative editing.
  - Implement state-based semilattice merge ($\sqcup$) with proven commutativity, associativity, and idempotency.
  - Implement delta-state extraction and delta-merge.
  - Emit immutable SHA-256 state receipts.

- [ ] **TASK-100-3: Module Exports & Package Subpath**
  - Add subpath export `"./crdt"` in `package.json`.
  - Re-export in `src/core/index.ts`.

- [ ] **TASK-100-4: CLI & MCP Integration**
  - Wire CLI commands `crdt:mutate`, `crdt:merge`, `crdt:delta` in `bin/commands/cliCrdtMesh.mjs`.
  - Wire into `bin/commands/cliPlatform.mjs` and `bin/commands/cliKernel.mjs`.
  - Wire MCP actions `crdt_mutate`, `crdt_merge`, `crdt_delta` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.

- [ ] **TASK-100-5: Unit & Integration Test Suite**
  - Author `test/eosCrdtStateSyncCore.test.mjs` (BDD-1094..BDD-1098).
  - Add step #27 to `test/eosEnterpriseFacade.test.mjs`.

- [ ] **TASK-100-6: Documentation & Catalog Index Update**
  - Document Módulo 30 in `docs/DEVELOPER_GUIDE.md`.
  - Update `docs/specs/openspec-catalog-index.json` to 210 specs.
  - Refresh tip and run 15-gate repo health verification.
