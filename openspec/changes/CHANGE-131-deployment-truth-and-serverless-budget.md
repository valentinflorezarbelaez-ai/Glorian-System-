# CHANGE-131 — Deployment Truth, Serverless Function Budget Gate & Production Restoration (`SPEC-269`)

## Metadata

- **Change ID**: CHANGE-131
- **Intake Reference**: [INTAKE-131-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET.md](file:///c:/Users/valen/Documents/Glorian-System/docs/intake/eos-system/INTAKE-131-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET.md)
- **Plan Reference**: [PLAN-131-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET.md](file:///c:/Users/valen/Documents/Glorian-System/docs/plans/PLAN-131-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET.md)
- **Tasks Reference**: [TASKS-131-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET.md](file:///c:/Users/valen/Documents/Glorian-System/docs/tasks/TASKS-131-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET.md)
- **Specification**: `SPEC-269` (`BDD-1391`..`BDD-1395`)
- **Status**: APPROVED
- **Authorization**: `AUTH-2026-11-14-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET` (`LEVEL 3`)

## 1. Summary of Changes

1. **P0 Production Restoration**:
   - Refactor `api/metrics.js` to internal handler module `api/_metrics.js`.
   - Dispatch `/api/metrics` via `api/kernel.js` preserving OpenMetrics `text/plain; version=0.0.4; charset=utf-8` exposition and 405 guards.
   - Configure rewrite in `vercel.json` (`/api/metrics` -> `/api/kernel?module=metrics`).
   - Pin Node version in `package.json` to `">=22.18.0 <25"` to prevent unvetted Node 26.x auto-upgrade in Vercel builds.
   - Update `test/apiMetrics.test.mjs`, `test/eosHorizon1OmegaBranchElevation.test.mjs`, and `scripts/verify-cicd-pipeline.mjs` Stage 6 in-process smoke runner.
2. **P1 Serverless Function Budget Gate (`SPEC-269`)**:
   - Add ratchet baseline `docs/quality/vercel-function-budget.json` (max 12 serverless functions).
   - Author gate runner `scripts/verify-vercel-function-budget.mjs` enforcing fail-closed budget evaluation.
   - Integrate budget gate into `package.json` (`npm run vercel:budget`) and `scripts/verify-cicd-pipeline.mjs` Stage 3.
3. **P1 Epistemic Honesty & Deployment Alignment**:
   - Enhance `bin/commands/cliJarvisPolyglotFrontierMesh.mjs` (`cmd_ship`) with `--remote` audit mode.
   - Update `scripts/eos-vercel-aca-live.mjs` with explicit synthetic labeling and raw error extraction.
   - Verify negative calibration of the function budget gate.
