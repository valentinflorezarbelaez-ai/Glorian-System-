# TASKS-107: Implementation Task Checklist for Bulletproofs Range Proofs (SPEC-222)

- [ ] Task 107.1: Author domain types in `src/core/eosBulletproofsRangeProofCore.types.ts` ($\le 800$ lines)
- [ ] Task 107.2: Implement secp256k1 point group, transparent vector generators, and Pedersen commitments in `src/core/eosBulletproofsRangeProofCore.ts` ($\le 800$ lines)
- [ ] Task 107.3: Implement logarithmic Inner Product Argument and Range Proof synthesis/verification algorithms
- [ ] Task 107.4: Subpath export `"./bulletproofs"` in `package.json` and export in `src/core/index.ts`
- [ ] Task 107.5: Implement CLI handler in `bin/commands/cliBulletproofsMesh.mjs` and register in `cliPlatform.mjs` / `cliKernel.mjs`
- [ ] Task 107.6: Implement MCP tools in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`
- [ ] Task 107.7: Author BDD test suite in `test/eosBulletproofsRangeProofCore.test.mjs` (BDD-1129..BDD-1133)
- [ ] Task 107.8: Add step #34 in `test/eosEnterpriseFacade.test.mjs` ($\le 800$ lines)
- [ ] Task 107.9: Document Módulo 37 in `docs/DEVELOPER_GUIDE.md`
- [ ] Task 107.10: Update `docs/specs/openspec-catalog-index.json` to 217 specs
- [ ] Task 107.11: Validate all 15 repo-health checks, run tests, commit and push to `origin main`
