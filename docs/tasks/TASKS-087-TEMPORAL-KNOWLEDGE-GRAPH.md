# TASKS-087: Layer-0 Temporal Knowledge Graph & Datalog Query Engine (SPEC-202)

- [ ] Task 1: Append `AUTH-2026-11-10-TKG-DATALOG-202` to `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] Task 2: Implement `src/core/eosTemporalKnowledgeGraph.ts`.
- [ ] Task 3: Export `./knowledge-graph` in `package.json` and re-export in `src/core/index.ts`.
- [ ] Task 4: Implement CLI commands `tkg:assert` and `tkg:query` in `bin/commands/cliPlatform.mjs` and update help in `bin/commands/cliKernel.mjs`.
- [ ] Task 5: Wire MCP actions `tkg_assert` and `tkg_query` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
- [ ] Task 6: Implement test suite `test/eosTemporalKnowledgeGraph.test.mjs` (BDD-1029..BDD-1033).
- [ ] Task 7: Add test case #14 in `test/eosEnterpriseFacade.test.mjs`.
- [ ] Task 8: Update `docs/DEVELOPER_GUIDE.md` with Módulo 17.
- [ ] Task 9: Update `docs/specs/openspec-catalog-index.json` to 197 specs.
- [ ] Task 10: Run full quality gates and push to `origin/main`.
