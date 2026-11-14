# TASKS-125 — Implementation Checklist (`CHANGE-125` / `SPEC-250`)

- [x] `T-01`: Author `INTAKE-125`, `CHANGE-125`, `SPEC-250`, `PLAN-125`, `TASKS-125`, and record `AUTH-2026-11-13-CLI-CATALOG-HYGIENE-GOVERNOR-250` (`LEVEL 3`).
- [x] `T-02`: Decompress `src/core/eosContainerSandbox.ts` (`<= 760` lines) via `src/core/eosContainerSandbox.types.ts`.
- [x] `T-03`: Decompress `eosMcpPhase7EnterpriseFrontierHandlers.ts` and `eosMcpPhase7EnterpriseFrontierHandlersExt.ts` by delegating `crdt_*`/`mmr_*`/`vss_*` helpers into `eosMcpPhase7EnterpriseFrontierHandlersExt2.ts`.
- [x] `T-04`: Extract and synchronize `bin/commands/cliHelpCatalog.mjs` (`v75.0.0`, full `SPEC-001`..`SPEC-250` coverage) and wire `bin/commands/cliKernel.mjs`.
- [x] `T-05`: Implement Module 65 (`src/core/eosCliCatalogAndHygieneGovernorCore.types.ts` & `.ts` — `SPEC-250`).
- [x] `T-06`: Export Module 65 in `src/core/index.ts`, expose `./hygiene-governor` & npm convenience scripts in `package.json`, wire `hygiene:audit` + enriched `ship` in CLI, and wire `cli_hygiene_audit` in MCP.
- [x] `T-07`: Create `test/eosCliCatalogHygieneGovernor.test.mjs` (`BDD-1271`..`BDD-1275`), add step `#52` in `test/eosEnterpriseFacade.test.mjs`, and document Module 65 + `hygiene:audit` in `docs/DEVELOPER_GUIDE.md`.
- [x] `T-08`: Format with Prettier, sync pins via `scripts/tip-refresh.mjs`, and pass all static checks and concurrent test suites.
- [x] `T-09`: Mark all tasks `[x]` and commit `SPEC-250`.
- [x] `T-10`: Seal Freeze Gate (`tip-refresh`) and push cleanly to `origin/main`.
