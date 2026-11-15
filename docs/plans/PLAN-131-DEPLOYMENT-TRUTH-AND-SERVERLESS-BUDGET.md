# PLAN-131 — Deployment Truth, Serverless Function Budget Gate & Production Restoration

## Metadata

- **Plan ID**: PLAN-131
- **Change Reference**: [CHANGE-131-deployment-truth-and-serverless-budget.md](file:///c:/Users/valen/Documents/Glorian-System/openspec/changes/CHANGE-131-deployment-truth-and-serverless-budget.md)
- **Spec Reference**: [SPEC-269-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET-GATE.md](file:///c:/Users/valen/Documents/Glorian-System/openspec/specs/SPEC-269-DEPLOYMENT-TRUTH-AND-SERVERLESS-BUDGET-GATE.md)
- **Status**: APPROVED

---

## 1. Architectural Decisions (ADRs)

### ADR-131-001: Consolidate `api/metrics.js` into Internal `api/_metrics.js` Routed via `api/kernel.js`

- **Context**: Vercel Hobby plan allows at most 12 Serverless Functions per deployment. `api/metrics.js` raised the count to 13, causing all production deployments to fail with `exceeded_serverless_functions_per_deployment`.
- **Decision**: Rename `api/metrics.js` to `api/_metrics.js` and add URL rewrite `{ "source": "/api/metrics", "destination": "/api/kernel?module=metrics" }` in `vercel.json`. `api/kernel.js` imports `_metrics.js` and passes request/response directly, preserving exact Prometheus OpenMetrics exposition headers and content.
- **Consequences**:
  - Positive: Reduces public function count to exactly 12 (complying with Vercel Hobby limit); fixes production deployment; preserves external scraper contract at `/api/metrics`.
  - Negative: `api/kernel.js` serves an additional route.

### ADR-131-002: Bounding Node.js Engine to `<25` in `package.json`

- **Context**: Vercel auto-selects Node `26.x` when `engines.node` is `">=22.18.0"`. Node 26 is unvetted in CI and local test harnesses.
- **Decision**: Update `package.json` `engines.node` to `">=22.18.0 <25"`.
- **Consequences**: Vercel builds deterministically on Node `24.x`.

### ADR-131-003: Serverless Function Budget Ratchet Gate

- **Context**: Zero gates in the repository previously counted serverless functions against platform quotas.
- **Decision**: Implement `scripts/verify-vercel-function-budget.mjs` and `docs/quality/vercel-function-budget.json`. Scan `api/`, exclude files/folders starting with `_`, and assert `count <= budget <= hardLimit`.
- **Consequences**: Prevents any future PR or commit from exceeding hosting provider serverless function limits.

### ADR-131-004: Epistemic Honesty Flag `--remote` in `eos ship`

- **Context**: `eos ship` previously evaluated only local gates, leading agents to claim `PRODUCTION_READY` when remote production was broken.
- **Decision**: Add optional `--remote` flag to `eos ship` that inspects `gh run list` and Vercel production deployment status before declaring `SHIP_APPROVED`.
- **Consequences**: Enforces EOS Law III (Evidence Over Claims).
