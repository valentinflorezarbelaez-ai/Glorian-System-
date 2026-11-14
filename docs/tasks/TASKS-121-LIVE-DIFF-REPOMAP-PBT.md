# TASKS-121 — Implementation Checklist (`CHANGE-121` / `SPEC-238`..`SPEC-240`)

- [x] `T-01`: Create SDD artifacts (`INTAKE-121`, `CHANGE-121`, `SPEC-238`, `SPEC-239`, `SPEC-240`, `PLAN-121`, `TASKS-121`, `AUTH-2026-11-13-LIVE-DIFF-REPOMAP-PBT-238-240`).
- [x] `T-02`: Implement `src/core/eosLiveGitDiffPrInspectorCore.types.ts` and `src/core/eosLiveGitDiffPrInspectorCore.ts` (`SPEC-238`).
- [x] `T-03`: Implement `src/core/eosRepoMapSymbolCompressorCore.types.ts` and `src/core/eosRepoMapSymbolCompressorCore.ts` (`SPEC-239`).
- [x] `T-04`: Implement `src/core/eosPropertyBasedShrinkingFuzzerCore.types.ts` and `src/core/eosPropertyBasedShrinkingFuzzerCore.ts` (`SPEC-240`).
- [x] `T-05`: Re-export Modules 53–55 in `src/core/index.ts` and expose `./live-diff`, `./repomap`, `./property-fuzzer` in `package.json`.
- [x] `T-06`: Wire `diff:live`, `repomap:build`, `pbt:check`, and `ship` in `bin/commands/cliJarvisPolyglotFrontierMesh.mjs` and MCP actions `live_diff_inspect`, `repomap_compress`, `pbt_shrink_check`, `jarvis_ship_readiness` in `eosMcpPhase7EnterpriseFrontierHandlersExt2.ts`.
- [x] `T-07`: Add BDD suites `BDD-1211`..`BDD-1225` + CLI/MCP smoke checks in `test/eosLiveDiffRepoMapPbt.test.mjs` and step `#48` in `test/eosEnterpriseFacade.test.mjs`.
- [x] `T-08`: Document Modules 53–55 and CLI commands (`diff:live`, `repomap:build`, `pbt:check`, `ship`) in `docs/DEVELOPER_GUIDE.md`.
- [x] `T-09`: Format all files with Prettier, sync pins via `scripts/tip-refresh.mjs`, and verify all static gates and test suites exit 0.
- [x] `T-10`: Mark tasks `[x]`, commit `SPEC-238..240`, seal Freeze Gate (`tip-refresh`), and push cleanly to `origin/main`.
