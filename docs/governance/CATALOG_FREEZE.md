# OpenSpec Catalog Freeze

Epistemic state: `ACTIVE` · sealed with fleet dogfood gate

## Rule

**No new OpenSpec id after SPEC-185** until:

1. `npm run fleet:dogfood` produces `docs/evidence/FLEET_DOGFOOD_TTV_RECEIPT.json` with `metrics.allOk=true`, and
2. `fleet.available >= 2` (control plane + at least one sibling checkout via `EOS_FLEET_*_PATH`).

Until then, improve by composing existing SPECs (184/185/039/delivery) only.

## Why

Big Tech EngProd freezes surface area when adoption metrics are missing. Catalog growth without fleet dogfood is governance theater.

## Current seal

- OpenSpecs at freeze intent: **180**
- Enforced by doctrine + fleet dogfood receipt `catalogFreeze.active`
