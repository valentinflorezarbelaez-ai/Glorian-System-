# Nightly Mutation / Flaky Ritual

<!-- Epistemic: RITUAL_DOC · CI truth = `.github/workflows/eos-nightly-deep-gates.yml` · Stage 4.6/4.7 hooks in `scripts/verify-cicd-pipeline.mjs` -->

**Purpose:** Keep Stage 4.6 (mutation) and Stage 4.7 (flaky) **SKIP on PR / `verify:strict`**, while guaranteeing a **fail-closed nightly** that actually exercises the ratchets.

## Why nightly (not every PR)

Mutation and flaky re-runs are expensive. The per-commit 7-stage gate therefore leaves them opt-in:

| Flag                     | Effect in `scripts/verify-cicd-pipeline.mjs`        |
| ------------------------ | --------------------------------------------------- |
| `EOS_MUTATION=1`         | Stage 4.6 runs `scripts/mutation-gate.mjs`          |
| `EOS_MUTATION_ENFORCE=1` | Ratchet violations fail closed (else advisory)      |
| `EOS_FLAKY=1`            | Stage 4.7 runs `scripts/flaky-gate.mjs`             |
| `EOS_FLAKY_ENFORCE=1`    | Flaky-budget violations fail closed (else advisory) |

**PR path:** leave `EOS_MUTATION` unset → Stage 4.6 prints `SKIP`. Do **not** force mutation on every PR.

**Main Ubuntu Node 22 leg** of sovereign CI already enables flaky fail-closed; mutation stays nightly-primary.

## Nightly ritual

Workflow: [`.github/workflows/eos-nightly-deep-gates.yml`](../../.github/workflows/eos-nightly-deep-gates.yml)

| Trigger                      | Behavior                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `schedule` (`0 2 * * *` UTC) | Mutation + flaky jobs with `EOS_*=1` and `*_ENFORCE=1`                        |
| `workflow_dispatch`          | Same gates; optional ratchet-refresh PR (write token scoped to that job only) |

Jobs reuse existing scripts (zero new npm runtime deps / Law V):

1. `node scripts/mutation-gate.mjs` → artifact **`MUTATION_NIGHTLY`** (+ `docs/evidence/MUTATION_NIGHTLY.json` in the artifact)
2. `node scripts/flaky-gate.mjs --repeat=${EOS_FLAKY_REPEATS}` → artifact **`FLAKY_NIGHTLY`** (+ `docs/evidence/FLAKY_NIGHTLY.json` in the artifact)

Local equivalents:

```bash
EOS_MUTATION=1 EOS_MUTATION_ENFORCE=1 npm run mutation:gate
EOS_FLAKY=1 EOS_FLAKY_ENFORCE=1 npm run flaky:gate
# or advisory deep verify:
npm run verify:deep
```

## Fail-closed policy

- Nightly mutation/flaky jobs **must exit non-zero** on ratchet / quarantine violations (standalone gate scripts already fail closed; workflow env mirrors Stage 4.6/4.7 enforce flags).
- Receipt JSON files are **run artifacts**, not tip-sealed claims of `PRODUCTION_READY`. Epistemic label: `NIGHTLY_FAIL_CLOSED`.
- Ratchet floors may only rise / quarantine may only shrink via the manual `update-ratchets` dispatch path.

## Related

- Specs: SPEC-131 (flaky), SPEC-143 (mutation), SPEC-177 (nightly wiring)
- Budgets: `docs/quality/mutation-budget.json`, `docs/quality/flaky-budget.json`
- Runbook symptoms: `docs/runbooks/eos-operational-runbook.md` (§ mutation / flaky)
- Canonical merge gate (mutation SKIP): `npm run verify:strict`
