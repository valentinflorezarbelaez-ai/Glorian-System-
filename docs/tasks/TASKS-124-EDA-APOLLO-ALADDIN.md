# TASKS-124 — Implementation Checklist (`CHANGE-124` / `SPEC-247`..`SPEC-249`)

- [x] `T-01`: Author `INTAKE-124`, `CHANGE-124`, `SPEC-247`, `SPEC-248`, `SPEC-249`, `PLAN-124`, `TASKS-124`, and record `AUTH-2026-11-13-EDA-APOLLO-ALADDIN-247-249` (`LEVEL 3`).
- [x] `T-02`: Refine documentation-only Beyoncé Rule classification in `src/core/eosIssueToPrCanaryBridgeCore.ts`.
- [x] `T-03`: Implement Module 62 (`src/core/eosEdaEquivalenceTimingProverCore.types.ts` & `.ts` — `SPEC-247`).
- [x] `T-04`: Implement Module 63 (`src/core/eosApolloAirGappedBundleOrchestratorCore.types.ts` & `.ts` — `SPEC-248`).
- [x] `T-05`: Implement Module 64 (`src/core/eosAladdinSystemicRiskStressCore.types.ts` & `.ts` — `SPEC-249`).
- [x] `T-06`: Export Modules 62–64 in `src/core/index.ts`, expose `./eda-prover`, `./apollo-airgap`, `./aladdin-stress` in `package.json`, wire CLI commands (`eda:prove`, `apollo:bundle`, `aladdin:stress`, enriched `ship`), and wire MCP actions.
- [x] `T-07`: Create `test/eosEdaApolloAladdin.test.mjs` (`BDD-1256`..`BDD-1270`), extend `test/eosEnterpriseFacade.test.mjs` (step `#51`), and document Modules 62–64 in `docs/DEVELOPER_GUIDE.md`.
- [x] `T-08`: Format with Prettier, sync pins via `scripts/tip-refresh.mjs`, and pass all static checks plus concurrent `node --test` suites.
- [x] `T-09`: Mark all tasks `[x]`, run CLI smoke checks, and commit `SPEC-247..249`.
- [x] `T-10`: Seal Freeze Gate (`tip-refresh`) and push cleanly to `origin/main`.
