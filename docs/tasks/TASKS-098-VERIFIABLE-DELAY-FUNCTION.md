# TASKS-098: Layer-0 Verifiable Delay Function Engine DAG

## Task Checklist

- [ ] **TASK-098-1: Type Definitions & VDF Contracts**
  - Create `src/core/eosVerifiableDelayFunctionCore.types.ts`.
  - Define `VdfParameters`, `VdfEvaluationResult`, `WesolowskiProof`, `VdfReceipt`.

- [ ] **TASK-098-2: Core Wesolowski VDF Implementation**
  - Implement `src/core/eosVerifiableDelayFunctionCore.ts`.
  - Modular exponentiation: `modPowBigInt(base, exp, mod)`.
  - Deterministic Miller-Rabin primality tester.
  - Fiat-Shamir prime challenge generator: `hashToPrime(x, y, T)`.
  - Sequential squaring evaluation: $y = x^{2^T} \pmod N$.
  - Wesolowski quotient proof generator: $\pi = x^{\lfloor 2^T / \ell \rfloor} \pmod N$.
  - Fast sub-millisecond verifier: $\pi^\ell \cdot x^r \equiv y \pmod N$.
  - Unbiased randomness beacon generation.

- [ ] **TASK-098-3: Module Exports & Package Subpath**
  - Add subpath export `"./vdf"` in `package.json`.
  - Re-export in `src/core/index.ts`.

- [ ] **TASK-098-4: CLI & MCP Integration**
  - Wire CLI commands `vdf:compute`, `vdf:verify`, `vdf:beacon` in `bin/commands/cliFrontierMesh.mjs`.
  - Update help in `bin/commands/cliKernel.mjs`.
  - Wire MCP actions `vdf_compute`, `vdf_verify`, `vdf_beacon` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.

- [ ] **TASK-098-5: Unit & Integration Test Suite**
  - Author `test/eosVerifiableDelayFunctionCore.test.mjs` (BDD-1084..BDD-1088).
  - Add step #25 to `test/eosEnterpriseFacade.test.mjs`.

- [ ] **TASK-098-6: Documentation & Catalog Index Update**
  - Document Módulo 28 in `docs/DEVELOPER_GUIDE.md`.
  - Update `docs/specs/openspec-catalog-index.json` to 208 specs.
  - Refresh tip with `npm run tip-refresh`.
