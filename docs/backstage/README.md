# Backstage integration (control plane)

**Status:** P0 catalog + TechDocs stub landed; **P1 Soundcheck scorecard entities + fleet mapping** in this folder.  
**Portal host:** TBD — separate package/repo (for example `apps/backstage/` or sibling `glorian-backstage`). **Never** as a runtime dependency inside `src/core/` (Law V / `dependencies: {}`).

## What lives here

| Artifact | Role |
| --- | --- |
| Root [`catalog-info.yaml`](../../catalog-info.yaml) | Backstage `Component` `eos-system-control-plane` + `System` `eos-sovereign-mesh` + Locations |
| Root [`mkdocs.yml`](../../mkdocs.yml) | Satisfies `backstage.io/techdocs-ref: dir:.` |
| [`app-config.snippet.yaml`](./app-config.snippet.yaml) | Catalog Location URLs for a future portal host (snippet only) |
| [`fleet-components.yaml`](./fleet-components.yaml) | Component stubs — `metadata.name` = `docs/projects/registry.json` id |
| [`soundcheck-scorecards.yaml`](./soundcheck-scorecards.yaml) | Resource entities for fleet matrix + five Soundcheck pillars |
| [`scorecard-pillar-map.json`](./scorecard-pillar-map.json) | Pillar → Backstage check ids; receipt shape; posture rules |
| This folder | Operator notes until a portal host exists |

## Soundcheck presentation rules (P1)

1. **Single writer:** `src/core/eosBackstageSoundcheckScorecard.ts` (SPEC-299). Portal **reads** `docs/evidence/SOUNDCHECK_SCORECARD_RECEIPT.json` — does not rescore.
2. **Posture honesty:** default annotation `eos.glorian/fleet-posture: CONTROL_PLANE_ONLY`. Advertise `FLEET_VERIFIED` only when fleet paths are mounted and `npm run fleet:audit` exits 0.
3. **No LEVEL_3 inflation:** registry `LEVEL_3_PRODUCTION_AUTHORIZED` ≠ live fleet Soundcheck success.
4. **No secrets** in catalog YAML or this snippet (Law VI).

## Ownership

- `spec.owner`: `user:valentin-florez-arbelaez`
- Tribe: not declared yet (AGENTS snapshot); Group entities land in a later ownership phase

## Explicit non-goals (still deferred)

- Full Backstage create-app / yarn workspaces / `@backstage/*` in root `package.json`
- Nine sibling `catalog-info.yaml` PRs (Law IV external writes — HITL per sibling)
- Soundcheck UI plugin runtime / MCP bridge
- TLC evidence or unrelated OpenSpec remediation

## Plan pointer

Project integration plan (HITL planning artifact): store path `docs/backstage-integration-plan.md` in the Glorian Project agent store. In-repo north star: [GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md](../governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md).
