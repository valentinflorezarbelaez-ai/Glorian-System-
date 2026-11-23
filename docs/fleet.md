# Fleet

Fleet identity source of truth: [projects/registry.json](projects/registry.json).

Useful local commands (control plane):

```bash
npm run fleet:audit
npm run fleet:scorecards
```

## Posture modes (P1-2 / PR-G)

| Mode | Meaning |
| --- | --- |
| `CONTROL_PLANE_ONLY` | Default when any `EOS_FLEET_*_PATH` is unset. Receipts set `fleetLiveAudit: false`. Registry LEVEL_3 ≠ live Soundcheck. |
| `FLEET_VERIFIED` | All fleet path envs set, siblings mounted, and `fleet:audit` green. Only then advertise live dogfood success. |

Cursor / cloud environment contract: [governance/CURSOR_ENVIRONMENT_FLEET_POSTURE.md](governance/CURSOR_ENVIRONMENT_FLEET_POSTURE.md).

The System entity for the mesh is `eos-sovereign-mesh`. Fleet Component stubs live in [backstage/fleet-components.yaml](backstage/fleet-components.yaml) until sibling repos land their own `catalog-info.yaml`. Default Soundcheck posture remains `CONTROL_PLANE_ONLY`. Ownership: [ownership.md](ownership.md).
