# Backstage integration (control plane)

**Status:** P0 catalog + TechDocs stub only.  
**Portal host:** TBD — separate package/repo (for example `apps/backstage/` or sibling `glorian-backstage`). **Never** as a runtime dependency inside `src/core/` (Law V / `dependencies: {}`).

## What lives here

| Artifact                                            | Role                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Root [`catalog-info.yaml`](../../catalog-info.yaml) | Backstage `Component` `eos-system-control-plane` + `System` `eos-sovereign-mesh` |
| Root [`mkdocs.yml`](../../mkdocs.yml)               | Satisfies `backstage.io/techdocs-ref: dir:.`                                     |
| This folder                                         | Operator notes for discovery until a portal host exists                          |

## Ownership

- `spec.owner`: `user:valentin-florez-arbelaez`
- Tribe: not declared yet (AGENTS snapshot); Group entities land in a later ownership phase

## Explicit non-goals (this stub)

- Full Backstage create-app / yarn workspaces
- `@backstage/*` packages in root `package.json`
- Fleet sibling `catalog-info.yaml` PRs
- Soundcheck UI plugin / MCP bridge
- TLC evidence or OpenSpec remediation work (orthogonal)

## Plan pointer

Project integration plan (HITL planning artifact): store path `docs/backstage-integration-plan.md` in the Glorian Project agent store. In-repo north star: [GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md](../governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md).
