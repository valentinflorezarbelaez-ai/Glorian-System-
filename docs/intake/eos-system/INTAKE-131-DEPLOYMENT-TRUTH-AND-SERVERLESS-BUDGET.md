# INTAKE-131 — Deployment Truth & Serverless Function Budget Gate

## Metadata

- **Intake ID**: INTAKE-131
- **Project**: Glorian System (`eos-system-control-plane`)
- **Date**: 2026-11-14
- **Author**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: INTAKE_COMPLETE
- **Priority**: P0 (Production Blocker Remediation & Epistemic Alignment)

---

## 1. Context & Problem Statement

During deep operational audit of Glorian System, a critical divergence between local gate verification and remote deployment truth was identified:

1. **Remote Production Deployment Failure**: Every Vercel production deployment since commit `bee103c1` (2026-11-10 23:02 UTC) has failed with `errorCode: exceeded_serverless_functions_per_deployment`. The Vercel Hobby plan strictly limits serverless functions to `<= 12`. The introduction of `api/metrics.js` increased the endpoint count to `13`, causing all subsequent production builds to fail during `Deploying outputs...`.
2. **Stale Production Environment**: Production (`glorian-system.vercel.app`) remained frozen serving an outdated release from 2026-11-10; improvements across `CHANGE-120` through `CHANGE-130` never reached live production.
3. **Remote CI Failure Cascading**: The `EOS Sovereign CI/CD` remote GitHub Actions workflow recorded ~57 consecutive failures due to `scripts/eos-vercel-aca-live.mjs` probing live deployment state and finding `REMEDIATION_REQUIRED` / `ROLLED_BACK_SAFE` / `incidentRequired: true`.
4. **Untriaged Incident #636**: Auto-generated incident issue `#636` remained open since 2026-11-11 without automated or human triage.
5. **Absence of Serverless Function Budget Gate**: The repository had zero automated gates counting serverless functions against hosting provider quotas. `eos ship` reported `SHIP_APPROVED` despite remote production being completely blocked.
6. **Untracked Node.js Major Upgrade Warning**: `package.json` specified `"engines": { "node": ">=22.18.0" }`, causing Vercel's build runner to automatically upgrade to Node `26.x`, an untested environment.

---

## 2. Remediation Objectives

1. **P0 — Restore Production Pipeline**:
   - Consolidate `api/metrics.js` into internal module `api/_metrics.js`, routed through `api/kernel.js` (`/api/metrics` rewrite in `vercel.json`).
   - Reduce active serverless function entrypoints from `13` to `12`, restoring full compliance with Vercel Hobby limits.
   - Constrain `"engines"` in `package.json` to `">=22.18.0 <25"` to guarantee deterministic Node 24.x execution on Vercel.
   - Update tests (`test/apiMetrics.test.mjs`, `test/eosHorizon1OmegaBranchElevation.test.mjs`, `scripts/verify-cicd-pipeline.mjs`).
2. **P1 — Serverless Function Budget Gate (`SPEC-269`)**:
   - Establish `docs/quality/vercel-function-budget.json` ratchet with hard limit `12` and allocated budget `12`.
   - Implement `scripts/verify-vercel-function-budget.mjs` scanning non-underscore entrypoints in `api/` and failing closed if count exceeds budget.
   - Integrate budget gate into `scripts/verify-cicd-pipeline.mjs` Stage 3, pre-commit fast lane, and `npm run vercel:budget`.
3. **P1 — Epistemic Truth in CLI Ship & Canary Probes**:
   - Enhance `eos ship` with `--remote` query capability to inspect remote CI and deployment readiness, ensuring no agent claims `PRODUCTION_READY` without verified live deployment.
   - Update `scripts/eos-vercel-aca-live.mjs` to extract real error details and transparently label synthesized canary telemetry.
   - Triage and close Incident `#636` upon verified production green deployment.
