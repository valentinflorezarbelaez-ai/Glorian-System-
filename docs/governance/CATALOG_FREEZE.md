# OpenSpec Catalog Freeze

Epistemic state: `UNLOCKED_WITHIN_TESTED_SCOPE` · sibling dogfood green

## Rule

**No new OpenSpec id after SPEC-185** until:

1. `npm run fleet:dogfood` produces `docs/evidence/FLEET_DOGFOOD_TTV_RECEIPT.json` with `metrics.allOk=true`, and
2. `fleet.available >= 2` (control plane + at least one sibling checkout via `EOS_FLEET_*_PATH` **or** registry `resolvedLocalDir` under `EOS_WORKSPACE_ROOT` / parent workspace).

When unlocked, still prefer composing existing SPECs (042/066/100/107/156/184/185/delivery) before opening a new id.

## Why

Big Tech EngProd freezes surface area when adoption metrics are missing. Catalog growth without fleet dogfood is governance theater.

## Current seal

- OpenSpecs at freeze intent: **180**
- Unlock signal observed: `metrics.siblingDogfoodReady=true` and `catalogFreeze.unlocked=true`
- Path resolution: `src/core/eosFleetPathResolver.ts` (env → control plane → localPath → resolvedLocalDir)
- Absolute machine paths are redacted from committed dogfood evidence (Law VI)
