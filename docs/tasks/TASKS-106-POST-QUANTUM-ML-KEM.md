# TASKS-106: Implementation Task Checklist for Post-Quantum ML-KEM Core (SPEC-221)

- [ ] Task 106.1: Author domain types in `src/core/eosPostQuantumMlKemCore.types.ts` ($\le 800$ lines)
- [ ] Task 106.2: Implement NTT tables, polynomial arithmetic, and sampling in `src/core/eosPostQuantumMlKemCore.ts` ($\le 800$ lines)
- [ ] Task 106.3: Implement IND-CCA2 `ML-KEM.KeyGen`, `ML-KEM.Encaps`, `ML-KEM.Decaps` with constant-time implicit rejection
- [ ] Task 106.4: Export `./ml-kem` and `./pqc` in `package.json` and `src/core/index.ts`
- [ ] Task 106.5: Implement CLI handler in `bin/commands/cliMlKemMesh.mjs` and register in `cliPlatform.mjs` / `cliKernel.mjs`
- [ ] Task 106.6: Implement MCP tools in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
- [ ] Task 106.7: Author BDD test suite in `test/eosPostQuantumMlKemCore.test.mjs` (BDD-1124..BDD-1128)
- [ ] Task 106.8: Add step #33 in `test/eosEnterpriseFacade.test.mjs` ($\le 800$ lines)
- [ ] Task 106.9: Document Módulo 36 in `docs/DEVELOPER_GUIDE.md`
- [ ] Task 106.10: Update `docs/specs/openspec-catalog-index.json` to 216 specs
- [ ] Task 106.11: Validate all 15 repo-health checks, run tests, commit and push to `origin main`
