# TASKS-095: Layer-0 Practical Byzantine Fault Tolerant (PBFT) Consensus Engine (SPEC-210)

- [x] Task 1: Append `AUTH-2026-11-11-PBFT-CONSENSUS-210` to `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] Task 2: Implement `src/core/eosPbftConsensusEngine.types.ts`.
- [x] Task 3: Implement `src/core/eosPbftConsensusEngine.ts`.
- [x] Task 4: Export `./pbft` in `package.json` and re-export in `src/core/index.ts`.
- [x] Task 5: Implement CLI commands `pbft:cluster`, `pbft:propose`, `pbft:status` in `bin/commands/cliFrontierMesh.mjs` and update help in `bin/commands/cliKernel.mjs`.
- [x] Task 6: Wire MCP actions `pbft_cluster`, `pbft_propose`, `pbft_slash` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts`.
- [x] Task 7: Author test suite `test/eosPbftConsensusEngine.test.mjs` (BDD-1069..BDD-1073).
- [x] Task 8: Add step #22 in `test/eosEnterpriseFacade.test.mjs`.
- [x] Task 9: Document Módulo 25 in `docs/DEVELOPER_GUIDE.md`.
- [x] Task 10: Update `docs/specs/openspec-catalog-index.json` to 205 specs and sync `catalogSha256`.
- [x] Task 11: Execute quality gates (`npm run typecheck`, `npm run lint`, `npm run tip-refresh`, tests) and push upstream.
