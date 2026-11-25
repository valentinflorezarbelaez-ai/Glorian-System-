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
- Append-only JSONL history of CI test counts

## Reading the local CI budget

Run `eos slo --json` to read the test-count history in `.eos/slo-events.jsonl`.

| Exit code | Meaning                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | The report on stdout contains `PASS` or `WARN`.                                                                                                                     |
| 1         | The fast burn-rate window breached its threshold. The report contains `BLOCK`.                                                                                      |
| 2         | The CLI could not read or validate the history. It leaves stdout empty and writes a diagnostic to stderr. A malformed record includes its filename and line number. |

Each event needs a timestamp in epoch milliseconds, a positive total and nonnegative integer pass and fail counts. Their sum may be below the total when some tests were skipped. An empty history yields `PASS` with zero tests contributing to the budget. With `EOS_SLO_ENFORCE=1`, CI stops when it cannot evaluate the SLO.

## Reading local test timings

Run `eos perf --json` to compare each suite's latest duration with its own history in `.eos/perf-baseline.jsonl`. The report counts suites with a usable comparison in `comparedSuites` and the rest in `unmeasuredSuites`. CI stage 4.4 reports the same counts for suites in the current run.

| Status                 | Meaning                                                                       | CLI exit code |
| ---------------------- | ----------------------------------------------------------------------------- | ------------- |
| `INSUFFICIENT_DATA`    | No suite has a usable comparison yet.                                         | 0             |
| `PARTIAL`              | The measured suites are within the threshold. Others still lack a comparison. | 0             |
| `CONFORMING`           | Every suite has a usable comparison and is within the threshold.              | 0             |
| `REGRESSIONS_DETECTED` | At least one suite exceeded twice its baseline, even if coverage is partial.  | 1             |

The baseline is the maximum of one to four prior measurements or the historical 95th percentile for five or more. Durations above five minutes are excluded because they can include machine suspension. A zero baseline or an excluded latest duration leaves that suite unmeasured. An unreadable or malformed history produces a diagnostic on stderr and exit code 2. CI reports performance findings as advisory.

## Fleet customer-facing edge SLO (synthetic)

Run `npm run fleet:slo` to probe every registered `productionUrl` for availability + TTFB and seal
`docs/evidence/FLEET_PRODUCTION_SLO_RECEIPT.json`.

Epistemic label: `SYNTHETIC_EDGE_PROBE_WITHIN_TESTED_SCOPE` — **not** browser RUM / CrUX field data.
Catalog freeze (`docs/governance/CATALOG_FREEZE.md`) requires this receipt green before new OpenSpec ids after SPEC-308.

### 30-day continuous ledger (local, no external firm)

Run **once per calendar day** (owner machine or CI cron):

```bash
npm run fleet:slo:30d
```

- Appends one sample to `docs/evidence/FLEET_SLO_30D_LEDGER.jsonl`
- Seals rolling receipt `docs/evidence/FLEET_SLO_30D_RECEIPT.json`
- One bounded retry absorbs transient edge flakes; does **not** invent missing calendar days
- `readyForAtoExitCriteria` stays `false` until ≥30 distinct daily ok samples exist in-window

Windows Task Scheduler example (daily 06:00 local):

```text
schtasks /Create /TN "GlorianFleetSlo30d" /SC DAILY /ST 06:00 /TR "npm run fleet:slo:30d" /WD "<repo-root>"
```

## Related

- Module: `src/core/eosSLOErrorBudgetGovernor.ts`
- Spec: `openspec/specs/SPEC-145.md`
- Tests: `test/eosSLOErrorBudgetGovernor.test.mjs`
- State: `.eos/slo-events.jsonl`
- Fleet edge probe: `scripts/fleet-production-slo.mjs`
