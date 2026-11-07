# Service Level Objectives (SLOs)

<!-- Google SRE standard (https://sre.google/sre-book/service-level-objectives/).
     The EOS System implements multi-window multi-burn-rate SLO governance via
     eosSLOErrorBudgetGovernor.ts. This document defines the objectives,
     error budgets, and the policy for consuming them. -->

## Service: Glorian System Control Plane

| Metric               | Target  | Window     | Alert Threshold |
| -------------------- | ------- | ---------- | --------------- |
| Availability         | 99.9%   | 30-day     | 14.4× burn (1h) |
| Test suite pass rate | 100%    | per-PR     | Any failure     |
| CI pipeline duration | < 5 min | per-PR     | > 10 min        |
| Coverage (lines)     | ≥ 80%   | per-PR     | < 80%           |
| Typecheck errors     | 0       | per-PR     | Any error       |
| Lint violations      | 0       | per-PR     | Any violation   |
| Secret leaks         | 0       | per-commit | Any leak        |

## Error Budget Policy

The 30-day availability error budget is **0.1%** (43.2 minutes of allowed
downtime per month). The error budget is consumed by:

1. **Failed CI gates** — each failed gate stage consumes budget proportional
   to its severity.
2. **Flaky tests** — each flaky test detection consumes budget.
3. **Mutation survivors** — each surviving mutant is a test gap that consumes
   budget.

### Burn Rate Alerts

| Burn Rate | Window  | Action                                     |
| --------- | ------- | ------------------------------------------ |
| 14.4×     | 1 hour  | **BLOCK** — freeze deployment immediately  |
| 6×        | 6 hours | **WARN** — investigate, prepare mitigation |
| 1×        | 3 days  | **ADVISORY** — track, no action needed     |

### Budget Exhaustion

When the error budget is exhausted (>100% consumed):

- All non-essential feature work freezes.
- The team focuses on reliability improvements.
- A postmortem is required for every new error event.

## SLO Governance Implementation

The `eosSLOErrorBudgetGovernor.ts` module (Layer-0, zero deps) implements:

- Multi-window burn rate calculation (1h, 6h, 3d)
- PASS / WARN / BLOCK verdicts
- SHA-256 receipt for every SLO evaluation
- Append-only SQLite WAL ledger for audit trail

## Related

- Module: `src/core/eosSLOErrorBudgetGovernor.ts`
- Spec: `openspec/specs/SPEC-145.md`
- Tests: `test/eosSLOErrorBudgetGovernor.test.mjs`
- State: `.eos/slo-events.jsonl`
