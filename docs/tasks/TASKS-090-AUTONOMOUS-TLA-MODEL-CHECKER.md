# TASKS-090: Autonomous Bounded TLA+ Model Checker & Invariant Synthesizer (SPEC-205)

- [ ] Task 1: Append `AUTH-2026-11-10-TLA-MODEL-CHECKER-205` to `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] Task 2: Implement `src/core/eosAutonomousTlaModelChecker.ts`.
- [ ] Task 3: Export `./tla-checker` in `package.json` and re-export in `src/core/index.ts`.
- [ ] Task 4: Implement CLI commands `tla:check` and `tla:synthesize` in `bin/commands/cliPlatform.mjs` and update help in `bin/commands/cliKernel.mjs`.
- [ ] Task 5: Wire MCP actions `tla_check` and `tla_synthesize` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
- [ ] Task 6: Implement test suite `test/eosAutonomousTlaModelChecker.test.mjs` (BDD-1044..BDD-1048).
- [ ] Task 7: Add test case #17 in `test/eosEnterpriseFacade.test.mjs`.
- [ ] Task 8: Update `docs/DEVELOPER_GUIDE.md` with Módulo 20.
- [ ] Task 9: Update `docs/specs/openspec-catalog-index.json` to 200 specs!
- [ ] Task 10: Run full quality gates and push to `origin/main`.
