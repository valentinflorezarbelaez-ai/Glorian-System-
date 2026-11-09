# Incident One-Pager — Glorian / Eos-System

**Audience**: on-call · **Epistemic**: WITHIN_TESTED_SCOPE · builder ≠ verifier

## 60-second triage

| Signal              | First command                                                               | Pass criteria       |
| ------------------- | --------------------------------------------------------------------------- | ------------------- |
| Gate / CI red       | `npm run verify:fast`                                                       | exit 0              |
| Secret leak         | `npm run secret-scan`                                                       | 0 live secrets      |
| Architecture drift  | `node bin/eos.mjs turbo`                                                    | STAGE_2_ARCH PASS   |
| Deploy bad          | `npx vercel rollback` (prod)                                                | prior alias healthy |
| Privacy lane breach | `EOS_LLM_PRIVACY_LANE=local npm test -- test/eosLlmOpsPrivacyLane.test.mjs` | all PASS            |

## Rollback (production)

1. Identify last good deployment / tip seal in `docs/releases/EOS_FREEZE_GATE_STATUS.md`.
2. `npx vercel rollback` against `eos-system-ten` (or promote prior alias).
3. Re-run `node bin/eos.mjs turbo` + `npm run mcp:verify` on the rolled-back tip.
4. Seal a receipt under `docs/evidence/` with SHA-256 of the rollback decision.

## Secret incident

1. Rotate the leaked credential at the provider (never commit the replacement).
2. Purge from git history / allowlist only fingerprints that are fixtures.
3. Re-run `npm run secret-scan` until exit 0.
4. Page owner if production traffic may have observed the secret.

## Severity → action

| Severity                       | Action                                     |
| ------------------------------ | ------------------------------------------ |
| P0 / customer-facing outage    | page on-call · war room · auto-revert      |
| P1 / gate floor broken on main | freeze deploys · fix forward or tip-revert |
| P2 / flaky / ratchet drift     | ticket · nightly quarantine budget         |
| P3–P4                          | log · schedule remediation                 |

## Escalation

Owner → Architect (Law IV / tip-seal) → External IV&V packet (`docs/assurance/EXTERNAL_IVV_AUDITOR_PACKET.md`).

Forbidden claims during incident: `NSA_GRADE`, `AEROSPACE_CERTIFIED`, `FEDERAL_ATO`, Level-5.
