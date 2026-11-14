# TASKS-122 — Implementation Checklist (`CHANGE-122` / `SPEC-241`..`SPEC-243`)

- [x] `T-01`: Harden `scripts/tip-refresh.mjs` (`writeFileWithRetry`, `--out=`) and isolate `test/eosReleaseDocConsistency.test.mjs` `--seal-pin` check in `os.tmpdir()` to eliminate Windows parallel lock errors (`errno: -4094`).
- [x] `T-02`: Sanitize hibernation outliers (`> 300,000 ms`) in `src/core/eosPerformanceRegressionTracker.ts` and restrict `scripts/quality-gates.mjs` regression reporting to active JUnit suites.
- [x] `T-03`: Author `INTAKE-122`, `CHANGE-122`, `SPEC-241`, `SPEC-242`, `SPEC-243`, `PLAN-122`, `TASKS-122`, and record `AUTH-2026-11-13-CONTRACT-SARIF-FLEET-SHIP-241-243` (`LEVEL 3`).
- [x] `T-04`: Implement Module 56 (`src/core/eosApiContractSemanticDiffCore.types.ts` & `.ts` — `SPEC-241`).
- [x] `T-05`: Implement Module 57 (`src/core/eosSarifDiagnosticPatchSynthesizerCore.types.ts` & `.ts` — `SPEC-242`).
- [x] `T-06`: Implement Module 58 (`src/core/eosFleetMultiRepoShipOrchestratorCore.types.ts` & `.ts` — `SPEC-243`).
- [x] `T-07`: Export Modules 56–58 in `src/core/index.ts`, expose `./contract-diff`, `./sarif`, `./fleet-ship` in `package.json`, and wire CLI (`contract:diff`, `sarif:export`, `fleet:ship`, upgraded `ship`) + MCP (`api_contract_diff`, `sarif_patch_synthesize`, `fleet_ship_orchestrate`).
- [x] `T-08`: Create `test/eosContractSarifFleetShip.test.mjs` (`BDD-1226`..`BDD-1240`), extend `test/eosEnterpriseFacade.test.mjs` (step `#49`), and document Modules 56–58 + CLI commands in `docs/DEVELOPER_GUIDE.md`.
- [x] `T-09`: Format with Prettier, sync pins via `scripts/tip-refresh.mjs`, and pass all static checks plus concurrent `node --test` suites (including `eosReleaseDocConsistency.test.mjs`).
- [x] `T-10`: Mark all tasks `[x]`, commit feature wave `SPEC-241..243`, seal Freeze Gate (`tip-refresh`), and push cleanly to `origin/main`.
