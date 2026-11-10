# On-Call Runbook — Glorian / Eos-System Fleet

<!-- Epistemic: OPERATIONAL · pairs with multi-window burn-rate alerts -->

## Rotation

| Window (UTC) | Primary                      | Backup                   | Page channel                                  |
| ------------ | ---------------------------- | ------------------------ | --------------------------------------------- |
| Default 24×7 | `@valentinflorezarbelaez-ai` | GitHub `incident` issues | GitHub Issues + Actions failure notifications |

Until a formal PagerDuty/Opsgenie bridge is funded, **GitHub Issues with label `incident` + `sre-burn-rate` are the page**.

## Alert sources (must page)

1. `.github/workflows/eos-sre-burn-rate.yml` — multi-window burn-rate BLOCK / freeze.
2. `.github/workflows/eos-aca-cron.yml` — ACA LIVE gate failure.
3. `npm run canary:product` exit 2 — product sibling rollback triggered.

## First 15 minutes

1. Ack the issue (comment `ACK <utc>`).
2. Run `npm run canary:product` and `npm run aca:live-gate` locally or via `workflow_dispatch`.
3. If rollbackPlan.trigger: execute Vercel rollback for the named sibling; freeze tip-seal claims.
4. Capture stdout into the incident issue; link `docs/evidence/*RECEIPT.json`.

## Error budget policy

- Fast burn (5m/30m) → page immediately; freeze deploys.
- Slow burn (1h/6h) → ticket within 1 business hour; no tip-seal until budget recovers.
- Enforcement: CI may set `EOS_SLO_ENFORCE=1` on `main` (see sovereign CI workflow).

## Off-call hygiene

- Do not close burn-rate incidents without a green re-probe receipt.
- Update `docs/evidence/DORA-METRICS.json` via `npm run dora:track` after recovery.
