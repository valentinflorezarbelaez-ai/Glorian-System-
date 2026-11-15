# TASKS-131 — Implementation Checklist (`CHANGE-131` / `SPEC-269`)

- [x] `T-01`: Author `INTAKE-131`, `CHANGE-131`, `SPEC-269`, `PLAN-131`, `TASKS-131`, and record `AUTH-2026-11-14-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET` (`LEVEL 3`).
- [x] `T-02`: Rename `api/metrics.js` to `api/_metrics.js`, integrate into `api/kernel.js` (`module === "metrics"`), and add rewrite in `vercel.json` (`/api/metrics` -> `/api/kernel?module=metrics`).
- [x] `T-03`: Update `package.json` `"engines"` field to `">=22.18.0 <25"` and add `"vercel:budget": "node scripts/verify-vercel-function-budget.mjs"`.
- [x] `T-04`: Update `test/apiMetrics.test.mjs`, `test/eosHorizon1OmegaBranchElevation.test.mjs`, and `scripts/verify-cicd-pipeline.mjs` Stage 6 in-process smoke checks to test routed metrics and `api/_metrics.js`.
- [x] `T-05`: Create `docs/quality/vercel-function-budget.json` (budget: 12, hardLimit: 12) and `scripts/verify-vercel-function-budget.mjs`.
- [x] `T-06`: Wire function budget gate into `scripts/verify-cicd-pipeline.mjs` Stage 3 and verify positive and negative calibration.
- [x] `T-07`: Author unit tests for `SPEC-269` (`BDD-1391`..`BDD-1395`) in `test/eosServerlessBudgetAndDeploymentTruth.test.mjs`.
- [x] `T-08`: Update `scripts/eos-vercel-aca-live.mjs` to extract raw deployment error code/message and explicitly label synthetic metrics.
- [x] `T-09`: Add `--remote` flag in `bin/commands/cliJarvisPolyglotFrontierMesh.mjs` (`cmd_ship`).
- [x] `T-10`: Run full test suite and CI verification (`npm run test:ci`), format codebase, update catalog/freeze gates, commit `CHANGE-131`, push to `origin/main`, verify live Vercel production deployment (`● Ready`), and close Incident `#636`.
