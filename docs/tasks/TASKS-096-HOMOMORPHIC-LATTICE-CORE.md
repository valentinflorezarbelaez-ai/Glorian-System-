# TASKS-096: Layer-0 Lattice-Based Homomorphic Encryption Core DAG

## Task Checklist

- [ ] **TASK-096-1: Type Definitions & Ring Contracts**
  - Create `src/core/eosHomomorphicLatticeCore.types.ts`.
  - Declare `HomomorphicParameters`, `Ciphertext`, `LatticeSecretKey`, `LatticePublicKey`, `LatticeKeypair`, `HomomorphicReceipt`.

- [ ] **TASK-096-2: Core Negacyclic Polynomial & BFV Operations**
  - Implement `src/core/eosHomomorphicLatticeCore.ts`.
  - Polynomial arithmetic: add, sub, negacyclic convolution mod $(q, X^N + 1)$.
  - Ternary sampling and bounded discrete Gaussian error sampling.
  - Public-key encryption with $\Delta = \lfloor q / t \rfloor$ encoding.
  - Homomorphic addition, subtraction, and scalar multiplication.
  - Decryption with phase decoding and noise budget tracking.
  - Tamper-evident SHA-256 receipts.

- [ ] **TASK-096-3: Module Exports & Package Subpath**
  - Add subpath `"./homomorphic"` in `package.json`.
  - Export `EosHomomorphicLatticeCore` in `src/core/index.ts`.

- [ ] **TASK-096-4: CLI & MCP Integration**
  - Integrate `homomorphic:keygen`, `homomorphic:encrypt`, `homomorphic:add`, `homomorphic:decrypt` in `bin/commands/cliFrontierMesh.mjs`.
  - Add CLI help in `bin/commands/cliKernel.mjs`.
  - Wire MCP actions `homomorphic_keygen`, `homomorphic_encrypt`, `homomorphic_add`, `homomorphic_decrypt` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.

- [ ] **TASK-096-5: Unit & Integration Test Suite**
  - Create `test/eosHomomorphicLatticeCore.test.mjs` verifying BDD-1074 through BDD-1078.
  - Wire step #23 into `test/eosEnterpriseFacade.test.mjs`.

- [ ] **TASK-096-6: Documentation & Catalog Index Update**
  - Register Módulo 26 in `docs/DEVELOPER_GUIDE.md`.
  - Update `docs/specs/openspec-catalog-index.json` to 206 specs.
  - Refresh tip with `npm run tip-refresh`.
