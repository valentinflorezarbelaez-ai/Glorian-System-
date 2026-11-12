# TASKS-097: Layer-0 Secure Multi-Party Computation Engine DAG

## Task Checklist

- [ ] **TASK-097-1: Type Definitions & MPC Contracts**
  - Create `src/core/eosSecureMpcShamirCore.types.ts`.
  - Define `MpcFieldParameters`, `SecretShare`, `BeaverTriple`, `MpcReceipt`, `MpcOperationType`.

- [ ] **TASK-097-2: Finite Field & Shamir Implementation**
  - Implement `src/core/eosSecureMpcShamirCore.ts`.
  - Modular inverse via Extended Euclidean Algorithm.
  - Shamir's $(k, N)$ splitting with random polynomial sampling.
  - Lagrange interpolation reconstruction with commitment validation.
  - Local homomorphic share addition, subtraction, scalar multiplication.
  - Beaver triple generation and interactive multiplication protocol $[x \cdot y]$.
  - SHA-256 computation receipts.

- [ ] **TASK-097-3: Module Exports & Package Subpath**
  - Add `"./mpc"` subpath in `package.json`.
  - Re-export in `src/core/index.ts`.

- [ ] **TASK-097-4: CLI & MCP Integration**
  - Add `mpc:split`, `mpc:combine`, `mpc:add`, `mpc:multiply` to `bin/commands/cliFrontierMesh.mjs`.
  - Add help entries to `bin/commands/cliKernel.mjs`.
  - Add MCP actions `mpc_split`, `mpc_combine`, `mpc_add`, `mpc_multiply` to `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.

- [ ] **TASK-097-5: Unit & Integration Test Suite**
  - Author `test/eosSecureMpcShamirCore.test.mjs` (BDD-1079..BDD-1083).
  - Add Step #24 to `test/eosEnterpriseFacade.test.mjs`.

- [ ] **TASK-097-6: Documentation & Catalog Index Update**
  - Document Módulo 27 in `docs/DEVELOPER_GUIDE.md`.
  - Update `docs/specs/openspec-catalog-index.json` to 207 specs.
  - Refresh tip with `npm run tip-refresh`.
