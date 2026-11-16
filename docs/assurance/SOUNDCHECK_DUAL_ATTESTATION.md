# Soundcheck Dual Attestation — end self-score monopoly

<!-- Epistemic: DUAL_ATTESTATION_REQUIRED · WITHIN_TESTED_SCOPE -->

## Problem

Fleet Soundcheck scores of **100 / A+** across all 9 repos are useful operational telemetry, but a Big Tech / lab auditor treats **self-scored 100** as non-adversarial unless an independent party re-attests.

## Dual-lane rule

| Lane          | Who                     | Artifact                                           | May claim                |
| ------------- | ----------------------- | -------------------------------------------------- | ------------------------ |
| Internal      | Builder / control plane | `eos_fleet_soundcheck` receipt                     | `INTERNAL_SOUNDCHECK`    |
| External IV&V | Independent human / org | Signed note in `EXTERNAL_IVV_EXECUTION_RECEIPT.md` | `EXTERNAL_SOUNDCHECK_OK` |

**Production narrative** may use `Soundcheck A+` only when **both** lanes are present for the same tip SHA (± tip-refresh lag).

## External verifier checklist (minimum)

1. Re-run `node bin/eos.mjs turbo` and `npm run fleet:dogfood` on a clean checkout.
2. Spot-check ≥ 2 sibling production URLs via `npm run fleet:slo`.
3. Confirm provenance `commitSha` equals `git rev-parse HEAD` after `node scripts/verify-supply-chain.mjs`.
4. Record tip SHA, date, verifier name/org, and pass/fail in `EXTERNAL_IVV_EXECUTION_RECEIPT.md`.

Forbidden: copying internal Soundcheck JSON and calling it external attestation.
