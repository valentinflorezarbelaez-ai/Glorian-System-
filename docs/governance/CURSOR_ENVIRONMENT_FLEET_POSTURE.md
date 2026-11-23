# Cursor environment — fleet audit posture

**Status:** normative for cloud agents and local CI without sibling mounts  
**Remediation:** P1-2 / PR-G  
**Related:** [`docs/fleet.md`](../fleet.md), [`docs/backstage/scorecard-pillar-map.json`](../backstage/scorecard-pillar-map.json)

## Modes

| Mode | `fleetLiveAudit` | When |
| --- | --- | --- |
| **`CONTROL_PLANE_ONLY`** | `false` | Any registered `EOS_FLEET_*_PATH` is unset, **or** a sibling checkout is missing / unusable |
| **`FLEET_VERIFIED`** | `true` | Every registered `EOS_FLEET_*_PATH` is set **and** every non-control-plane sibling resolves `AVAILABLE`, **and** `npm run fleet:audit` exits 0 |

Registry `LEVEL_3_PRODUCTION_AUTHORIZED` is **documentary authorization**. It is **not** live Soundcheck success.

## Cursor / cloud default

Typical Cursor Cloud and CI checkouts only contain the control plane. In that case:

1. All `EOS_FLEET_*_PATH` values are unset.
2. Posture **must** be `CONTROL_PLANE_ONLY`.
3. Receipts (`LOCAL-CHECKS-RECEIPT.json`, `FLEET_POSTURE_RECEIPT.json`, SARIF invocation properties) advertise `fleetLiveAudit: false`.
4. Agents and docs **must not** claim `FLEET_VERIFIED` or live Soundcheck success.

## Dogfood host (optional)

To reach `FLEET_VERIFIED` on a workstation or dedicated environment:

1. Clone sibling fleet repos beside the control plane (or point env vars at absolute checkouts).
2. Export every `localPathEnv` from `docs/projects/registry.json` (for example `EOS_FLEET_CRUD_SLACK_PATH`, …).
3. Run `npm run fleet:audit` (exit 0) and optionally `npm run fleet:scorecards`.
4. For fail-closed dogfood gates: `EOS_FLEET_POSTURE_STRICT=1 npm run fleet:audit` (exits 1 under `CONTROL_PLANE_ONLY`).

Mounting siblings in the Cursor Dashboard environment is **ops** (remediation PR-H), not required for control-plane merge gates.

## Receipt fields

Compact fields embedded in local-check / fleet receipts (no host absolute paths):

- `posture`
- `fleetLiveAudit`
- `envPathsDeclared` / `envPathsUnset` / `envPathsUnsetCount`
- `siblingsAvailable` / `siblingsSkipped`
- `reason`

## Commands

```bash
npm run fleet:audit        # emits docs/evidence/FLEET_POSTURE_RECEIPT.json + SARIF
npm run fleet:scorecards   # product scorecards (still honor CONTROL_PLANE_ONLY annotations)
npm run verify:strict      # LOCAL-CHECKS-RECEIPT includes fleetPosture
```
