# TASKS-126 — Implementation Checklist (`CHANGE-126` / `SPEC-251`..`SPEC-253`)

- [x] `T-01`: Author `INTAKE-126`, `CHANGE-126`, `SPEC-251`, `SPEC-252`, `SPEC-253`, `PLAN-126`, `TASKS-126`, and record `AUTH-2026-11-14-ROOFLINE-SPC-KALMAN-FRONTIER-253` (`LEVEL 3`).
- [x] `T-02`: Decompress the top 6 largest modules (`cliFrontierMesh.mjs`, `verify-cicd-pipeline.mjs`, `eosGentlemanAutoUpdater.ts`, `tlaSimulationsPart2.mjs`, `eosKnowledgeGraphEngine.ts`, `eosSpotifyCodex.ts`) to `<= 782` lines (`minHeadroomLines >= 18`) while keeping `contract:live` backward-compatible.
- [x] `T-03`: Implement Module 66 (`src/core/eosComputeGraphRooflinePlannerCore.types.ts` & `.ts` — `SPEC-251`).
- [x] `T-04`: Implement Module 67 (`src/core/eosStatisticalProcessYieldControlCore.types.ts` & `.ts` — `SPEC-252`).
- [x] `T-05`: Implement Module 68 (`src/core/eosKalmanStateEstimatorAndQuadVoterCore.types.ts` & `.ts` — `SPEC-253`).
- [x] `T-06`: Export Modules 66–68 in `src/core/index.ts`, expose `./roofline-planner`, `./spc-yield`, `./kalman-voter` + npm scripts in `package.json`, wire `roofline:plan`, `spc:audit`, `kalman:estimate` + enriched `ship` in CLI, and wire MCP actions under `eos_enterprise_workspace`.
- [x] `T-07`: Synchronize `bin/commands/cliHelpCatalog.mjs` (`v75.0.0`, preserving `SPEC-065` headings) and bring `docs/DEVELOPER_GUIDE.md` to `342/342` (`100%`) command documentation parity plus Modules 66–68.
- [x] `T-08`: Author `test/eosRooflineSpcKalmanFrontier.test.mjs` (`BDD-1276`..`BDD-1290`) and step `#53` in `test/eosEnterpriseFacade.test.mjs`.
- [x] `T-09`: Format with Prettier, refresh pins via `scripts/tip-refresh.mjs`, and pass `hygiene:audit`, `contract:live`, `ship`, all 8 static gates, and the full concurrent test suite.
- [x] `T-10`: Mark all tasks `[x]`, commit `SPEC-251..253`, seal Freeze Gate (`tip-refresh --seal-pin`), and push cleanly to `origin/main`.
