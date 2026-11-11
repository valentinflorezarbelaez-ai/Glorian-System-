# TASKS-101: Layer-0 Merkle Mountain Range (MMR) & Cryptographic Accumulator Engine DAG

## Task Checklist

- [ ] **TASK-101-1: Type Definitions & MMR Contracts**
  - Create `src/core/eosMerkleMountainRangeCore.types.ts`.
  - Define `MmrNode`, `MmrPeak`, `MmrInclusionProof`, `MmrConsistencyProof`, `MmrSnapshot`, `MmrReceipt`, `MmrVerificationResult`.

- [ ] **TASK-101-2: Core MMR Engine Implementation**
  - Implement `src/core/eosMerkleMountainRangeCore.ts`.
  - Bitwise positional arithmetic: node height $h(pos)$, parent, left child, right child, sibling.
  - Peak computation from leaf count and total node size.
  - Append leaf and automatic mountain climbing / summit merging.
  - Bag-of-peaks canonical root calculation with SHA-256.
  - $O(\log n)$ inclusion proof generation and sub-millisecond verification.
  - Consistency proof generation and verification across historical sizes.
  - Tamper-evident SHA-256 state receipts.

- [ ] **TASK-101-3: Module Exports & Package Subpath**
  - Add subpath export `"./mmr"` in `package.json`.
  - Re-export in `src/core/index.ts`.

- [ ] **TASK-101-4: CLI & MCP Integration**
  - Wire CLI commands `mmr:append`, `mmr:prove`, `mmr:verify` in `bin/commands/cliMmrMesh.mjs`.
  - Wire into `bin/commands/cliPlatform.mjs` and `bin/commands/cliKernel.mjs`.
  - Wire MCP actions `mmr_append`, `mmr_prove`, `mmr_verify` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.

- [ ] **TASK-101-5: Unit & Integration Test Suite**
  - Author `test/eosMerkleMountainRangeCore.test.mjs` (BDD-1099..BDD-1103).
  - Add step #28 to `test/eosEnterpriseFacade.test.mjs`.

- [ ] **TASK-101-6: Documentation & Catalog Index Update**
  - Document Módulo 31 in `docs/DEVELOPER_GUIDE.md`.
  - Update `docs/specs/openspec-catalog-index.json` to 211 specs.
  - Refresh tip and run 15-gate repo health verification.
