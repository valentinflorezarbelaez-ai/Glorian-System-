# TASKS-120 — Implementation Checklist (`CHANGE-120` / `SPEC-235`..`SPEC-237`)

- [x] `T-01`: Create SDD artifacts (`INTAKE-120`, `CHANGE-120`, `SPEC-235`, `SPEC-236`, `SPEC-237`, `PLAN-120`, `TASKS-120`, `AUTH-2026-11-13-JARVIS-POLYGLOT-FRONTIER-235-237`).
- [x] `T-02`: Implement `src/core/eosPolyglotToolchainAdapterCore.types.ts` and `src/core/eosPolyglotToolchainAdapterCore.ts` (`SPEC-235`).
- [x] `T-03`: Implement `src/core/eosIssueToPrCanaryBridgeCore.types.ts` and `src/core/eosIssueToPrCanaryBridgeCore.ts` (`SPEC-236`).
- [x] `T-04`: Implement `src/core/eosStaffEngineerAdversarialJudgeCore.types.ts` and `src/core/eosStaffEngineerAdversarialJudgeCore.ts` (`SPEC-237`).
- [x] `T-05`: Re-export Modules 50–52 in `src/core/index.ts` and expose `./polyglot`, `./issue-bridge`, `./staff-judge` in `package.json`.
- [x] `T-06`: Implement `bin/commands/cliJarvisPolyglotFrontierMesh.mjs` (`polyglot:*`, `bridge:*`, `staff:*`) and wire into `bin/commands/cliPlatform.mjs`.
- [x] `T-07`: Extend `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts` with 6 frontier MCP actions (`polyglot_detect`, `polyglot_normalize`, `issue_bridge_parse`, `diff_migration_audit`, `canary_rollback_plan`, `staff_adversarial_judge`).
- [x] `T-08`: Update `scripts/tip-refresh.mjs` (auto-sync `AGENTS.md` + `openspec-catalog-index.json`) and optimize `.githooks/pre-push` + `scripts/verify-cicd-pipeline.mjs` PTS commit-diff fallback.
- [x] `T-09`: Add BDD suites `BDD-1196`..`BDD-1210` + CLI/MCP smoke checks in `test/eosJarvisPolyglotFrontier.test.mjs` and step `#47` in `test/eosEnterpriseFacade.test.mjs`.
- [x] `T-10`: Document Modules 50, 51, and 52 plus CLI commands in `docs/DEVELOPER_GUIDE.md`.
- [x] `T-11`: Format all touched files with Prettier and refresh pins via `scripts/tip-refresh.mjs`.
- [x] `T-12`: Verify all static gates (`typecheck`, `lint`, `boundary:check`, `complexity:check`, `verify:references`, `secret-scan`, `verify-packaging.mjs`) and test suites pass with exit code 0.
