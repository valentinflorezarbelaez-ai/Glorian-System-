# Backstage integration (control plane)

**Status:** P0 catalog + TechDocs stub · P1 Soundcheck scorecard entities · P2 TechDocs curated nav + ownership Groups · **P2 Layer-0 boundary/consumer scorecards (PR-I)**.  
**Portal host:** TBD — separate package/repo (for example `apps/backstage/` or sibling `glorian-backstage`). **Never** as a runtime dependency inside `src/core/` (Law V / `dependencies: {}`).

## What lives here

| Artifact                                                             | Role                                                                                         |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Root [`catalog-info.yaml`](../../catalog-info.yaml)                  | Backstage `Component` `eos-system-control-plane` + `System` `eos-sovereign-mesh` + Locations |
| Root [`mkdocs.yml`](../../mkdocs.yml)                                | TechDocs nav: Home / Verify / Fleet / Governance / Ownership / Backstage                     |
| [`app-config.snippet.yaml`](./app-config.snippet.yaml)               | Portal snippet: **only** root `catalog-info.yaml` (Locations cascade)                        |
| [`fleet-components.yaml`](./fleet-components.yaml)                   | Component stubs — `metadata.name` = `docs/projects/registry.json` id                         |
| [`soundcheck-scorecards.yaml`](./soundcheck-scorecards.yaml)         | Resource entities for fleet matrix + five Soundcheck pillars                                 |
| [`l0-boundary-scorecards.yaml`](./l0-boundary-scorecards.yaml)       | Resource entities for Layer-0 import boundary + consumer moratorium                          |
| [`ownership.yaml`](./ownership.yaml)                                 | User + squad/tribe Group entities (P2)                                                       |
| [`scorecard-pillar-map.json`](./scorecard-pillar-map.json)           | Soundcheck pillar → Backstage check ids; receipt shape; posture rules                        |
| [`l0-boundary-scorecard-map.json`](./l0-boundary-scorecard-map.json) | L0 boundary/consumer → check ids; fail-closed rules; receipt shape                           |
| This folder                                                          | Operator notes until a portal host exists                                                    |

## Catalog ingestion (single path)

1. Portal `catalog.locations` registers **one** URL: root [`catalog-info.yaml`](../../catalog-info.yaml).
2. Nested `Location` entities inside that file use `spec.type: url` + absolute GitHub blob targets for fleet stubs, Soundcheck Resources, ownership Groups, and templates.
3. **Do not** also list `fleet-components.yaml` / `soundcheck-scorecards.yaml` / `ownership.yaml` as sibling `catalog.locations` — that double-registers entities.
4. Prefer **URL** Locations; no `file:` / relative `./` targets under a URL-ingested parent.

## Soundcheck presentation rules (P1)

1. **Single writer:** `src/core/eosBackstageSoundcheckScorecard.ts` (SPEC-299). Portal **reads** `docs/evidence/SOUNDCHECK_SCORECARD_RECEIPT.json` — does not rescore.
2. **Posture honesty:** default annotation `eos.glorian/fleet-posture: CONTROL_PLANE_ONLY`. Advertise `FLEET_VERIFIED` only when fleet paths are mounted and `npm run fleet:audit` exits 0.
3. **No LEVEL_3 inflation:** registry `LEVEL_3_PRODUCTION_AUTHORIZED` ≠ live fleet Soundcheck success.
4. **No secrets** in catalog YAML or this snippet (Law VI).

## Ownership (P2)

| Role                 | Entity                              | Notes                                           |
| -------------------- | ----------------------------------- | ----------------------------------------------- |
| Squad (`spec.owner`) | `group:glorian-control-plane-squad` | Primary owner on Component / System / Resources |
| Tribe                | `group:glorian-platform-tribe`      | Declared (replaces AGENTS `NOT_DECLARED`)       |
| Member               | `user:valentin-florez-arbelaez`     | Architect; `memberOf` the squad                 |

TechDocs page: [`docs/ownership.md`](../ownership.md). Catalog SoT: [`ownership.yaml`](./ownership.yaml).

## Layer-0 boundary + consumer scorecards (P2 / PR-I)

1. **Gates (SoT):** `npm run boundary:check` and `npm run consumers:audit` (`--check-only --fail-on-unconsumed`) — wired into `verify:strict` as Stage 3.02 / 3.03. Check-only does **not** rewrite the committed receipt.
2. **Receipt:** [`docs/evidence/MODULE_CONSUMER_GRAPH.json`](../evidence/MODULE_CONSUMER_GRAPH.json). Portal **reads** it — does not rescore. Regenerate intentionally with `node scripts/verify-module-consumers.mjs` (omit `--check-only`).
3. **Catalog:** [`l0-boundary-scorecards.yaml`](./l0-boundary-scorecards.yaml) via Location `glorian-l0-boundary-scorecards` (URL target only; not duplicated in app-config).
4. **Ownership blast radius:** Core maintainers / control-plane squad own L0 boundary failures (see remediation plan P2-1).

## Explicit non-goals (still deferred)

- Full Backstage create-app / yarn workspaces / `@backstage/*` in root `package.json`
- Nine sibling `catalog-info.yaml` PRs (Law IV external writes — HITL per sibling)
- Soundcheck UI plugin runtime / MCP bridge
- Weekly orphan report job / export-surface vanity ceilings (PR-J phase 2)
- TLC evidence or unrelated OpenSpec / GDD / MCP Tier-0 remediations

## Plan pointer

Project integration plan (HITL planning artifact): store path `docs/backstage-integration-plan.md` in the Glorian Project agent store. In-repo north star: [GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md](../governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md).
