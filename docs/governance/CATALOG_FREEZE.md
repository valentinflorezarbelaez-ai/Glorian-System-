# OpenSpec Catalog Freeze

Epistemic state: `UNLOCKED_WITHIN_TESTED_SCOPE` · adoption refresh green · still prefer compose-over-new-id

## Rule

**No new OpenSpec id after SPEC-309** until:

1. `npm run fleet:dogfood` produces `docs/evidence/FLEET_DOGFOOD_TTV_RECEIPT.json` with `metrics.allOk=true`, and
2. `fleet.available >= 2` (control plane + at least one sibling checkout via `EOS_FLEET_*_PATH` **or** registry `resolvedLocalDir` under `EOS_WORKSPACE_ROOT` / parent workspace), and
3. `npm run fleet:slo` seals `docs/evidence/FLEET_PRODUCTION_SLO_RECEIPT.json` with `metrics.allOk=true` (synthetic edge probe; not browser RUM).

When unlocked, still prefer composing existing SPECs before opening a new id. Human external IV&V remains open (`docs/assurance/EXTERNAL_IVV_EXECUTION_RECEIPT.md`).

## Why

Big Tech EngProd freezes surface area when catalog growth outpaces adoption evidence. 308 specs without fresh dogfood + customer-facing SLO receipts is governance theater.

## Current seal (2026-11-16)

- OpenSpecs at freeze intent: **309** (includes SPEC-309 polyglot kernel landed on tip during remediation)
- Unlock signals observed: `metrics.allOk=true` on fleet dogfood + fleet production SLO (9/9 nominal)
- Path resolution: `src/core/eosFleetPathResolver.ts` (env → control plane → localPath → resolvedLocalDir)
- Absolute machine paths are redacted from committed dogfood evidence (Law VI)
- Provenance tip-seal must bind to release HEAD via `node scripts/verify-supply-chain.mjs` / `npm run supply-chain:bind`
