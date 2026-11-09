# Vercel CI Secrets (ACA live path)

Repository secrets used by `aca:vercel` and `.github/workflows/eos-aca-cron.yml`.
Never commit token values. Prefer GitHub Actions → Settings → Secrets and variables → Actions.

| Secret | Required for live path | Purpose |
| --- | --- | --- |
| `VERCEL_TOKEN` | Yes | Bearer token for Vercel REST (`/v6/deployments`) |
| `VERCEL_PROJECT_ID` | Optional | Overrides `docs/governance/vercel-fleet-projects.json` `controlPlane.projectId` |
| `VERCEL_TEAM_ID` | Optional | Overrides committed `teamId` when the token is team-scoped |

## Fail-closed behavior

- Without `VERCEL_TOKEN`, `npm run aca:vercel` uses the committed live snapshot (if present) or the hermetic fixture. The gate still must exit 0.
- With a valid token, the script probes the latest production deployment readiness and seals ACA evidence under `docs/evidence/`.
- Cron runs every 6 hours (`eos-aca-cron.yml`) and also enables `EOS_FLEET_SCORECARD_PROBE=1` for HEAD probes against registry `productionUrl` values.

## Operator checklist

1. Create a Vercel token with read access to the Glorian control-plane project.
2. Add `VERCEL_TOKEN` (and optionally project/team IDs) as repository secrets.
3. Dispatch **EOS ACA Canary Cron** manually once and confirm the job summary / artifacts.
4. Confirm PR CI step `Vercel ACA live-or-fixture seal` no longer falls back solely because secrets are missing.

Epistemic scope: `WITHIN_TESTED_SCOPE` — secrets configuration does not by itself certify production SLOs.
