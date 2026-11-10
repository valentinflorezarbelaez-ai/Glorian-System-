# Vercel CI Secrets (ACA live path)

Repository secrets used by `aca:vercel` and `.github/workflows/eos-aca-cron.yml`.
Never commit token values. Prefer GitHub Actions → Settings → Secrets and variables → Actions.

**Public repo note (2026-11-09):** Glorian-System- is `PUBLIC`, so Actions minutes are unrestricted for Linux/macOS public workflows; secrets are still required for the **live** Vercel ACA path (fixture/snapshot remains the fail-closed default without `VERCEL_TOKEN`).

| Secret                     | Required for live path                                | Purpose                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`             | Yes                                                   | Bearer token for Vercel REST (`/v6/deployments`)                                                                                                                                                                                                                                                                                                                                 |
| `VERCEL_PROJECT_ID`        | Optional                                              | Overrides `docs/governance/vercel-fleet-projects.json` `controlPlane.projectId`                                                                                                                                                                                                                                                                                                  |
| `VERCEL_TEAM_ID`           | Optional                                              | Overrides committed `teamId` when the token is team-scoped                                                                                                                                                                                                                                                                                                                       |
| `EOS_FLEET_CHECKOUT_TOKEN` | **Required** for private sibling scorecards/checkouts | Fine-grained (or classic) PAT with `contents:read` on private fleet siblings (e.g. `portafolio`). Wired in `.github/workflows/eos-sovereign-cicd.yml` as `secrets.EOS_FLEET_CHECKOUT_TOKEN \|\| github.token`. Without it, private dogfood checkout is skipped (`continue-on-error`) and TTV records `SKIPPED_SIBLING` — do **not** rely on Vercel alone for private git access. |

## Fail-closed behavior

- Without `VERCEL_TOKEN`, `npm run aca:vercel` uses the committed live snapshot (if present) or the hermetic fixture. The gate still must exit 0.
- With a valid token, the script probes the latest production deployment readiness and seals ACA evidence under `docs/evidence/`.
- Cron runs every 6 hours (`eos-aca-cron.yml`) and also enables `EOS_FLEET_SCORECARD_PROBE=1` for HEAD probes against registry `productionUrl` values.

## Operator checklist

1. Create a Vercel token with read access to the Glorian control-plane project.
2. Add `VERCEL_TOKEN` (and optionally project/team IDs) as repository secrets.
3. Create a **fine-grained PAT** (`EOS_FLEET_CHECKOUT_TOKEN`) with read-only Contents on private fleet repos; add it as a repository secret (never commit the value). Prefer this over depending only on Vercel for private checkouts.
4. Confirm `gh secret list` shows `EOS_FLEET_CHECKOUT_TOKEN`.
5. Dispatch **EOS ACA Canary Cron** manually once and confirm the job summary / artifacts.
6. Confirm PR CI step `Vercel ACA live-or-fixture seal` no longer falls back solely because secrets are missing.
7. Confirm cron step **ACA LIVE gate** passes with `mode=LIVE_DEPLOYMENT_PROBE` (or `LIVE_CAPTURED_SNAPSHOT`). Fixture while a token is set is a **hard fail**.
8. On LIVE gate failure, cron opens a GitHub issue (incident) — triage via `docs/runbooks/INCIDENT_ONE_PAGER.md`.

Epistemic scope: `WITHIN_TESTED_SCOPE` — secrets configuration does not by itself certify production SLOs.
