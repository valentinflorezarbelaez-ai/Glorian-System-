# TASKS-093: Layer-0 Reverse-Mode Automatic Differentiation & Multidimensional Tensor Core (SPEC-208)

- [x] Task 1: Append `AUTH-2026-11-10-AUTODIFF-TENSOR-208` to `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] Task 2: Implement `src/core/eosReverseModeAutodiff.ts`.
- [x] Task 3: Export `./autodiff` in `package.json` and re-export in `src/core/index.ts`.
- [x] Task 4: Implement CLI commands `autodiff:grad` and `autodiff:train` in `bin/commands/cliPlatform.mjs` and update help in `bin/commands/cliKernel.mjs`.
- [x] Task 5: Wire MCP actions `autodiff_grad` and `autodiff_train` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
- [x] Task 6: Implement test suite `test/eosReverseModeAutodiff.test.mjs` (BDD-1059..BDD-1063).
- [x] Task 7: Add test case #20 in `test/eosEnterpriseFacade.test.mjs`.
- [x] Task 8: Update `docs/DEVELOPER_GUIDE.md` with Módulo 23.
- [x] Task 9: Update `docs/specs/openspec-catalog-index.json` to 203 specs.
- [x] Task 10: Run full quality gates and push to `origin/main`.
