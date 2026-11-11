# TASKS-094: Layer-0 Streaming Isolation Forest Anomaly Detector (SPEC-209)

- [x] Task 1: Append `AUTH-2026-11-10-ISOLATION-FOREST-209` to `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] Task 2: Implement `src/core/eosIsolationForestDetector.ts`.
- [x] Task 3: Export `./isolation-forest` in `package.json` and re-export in `src/core/index.ts`.
- [x] Task 4: Implement CLI commands `anomaly:detect` and `anomaly:forest` in `bin/commands/cliPlatform.mjs` and update help in `bin/commands/cliKernel.mjs`.
- [x] Task 5: Wire MCP actions `anomaly_detect` and `anomaly_forest` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
- [x] Task 6: Implement test suite `test/eosIsolationForestDetector.test.mjs` (BDD-1064..BDD-1068).
- [x] Task 7: Add test case #21 in `test/eosEnterpriseFacade.test.mjs`.
- [x] Task 8: Update `docs/DEVELOPER_GUIDE.md` with Módulo 24.
- [x] Task 9: Update `docs/specs/openspec-catalog-index.json` to 204 specs.
- [x] Task 10: Run full quality gates and push to `origin/main`.
