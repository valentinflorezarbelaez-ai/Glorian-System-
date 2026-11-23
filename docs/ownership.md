# Ownership

Backstage ownership for the Glorian/EOS control plane is **declared** in catalog entities (not left blank / `NOT_DECLARED`).

| Role                         | Entity ref                          | Kind                |
| ---------------------------- | ----------------------------------- | ------------------- |
| Squad (primary `spec.owner`) | `group:glorian-control-plane-squad` | Group `type: team`  |
| Tribe                        | `group:glorian-platform-tribe`      | Group `type: tribe` |
| Architect (member)           | `user:valentin-florez-arbelaez`     | User                |

## Source of truth

- Catalog YAML: [`backstage/ownership.yaml`](backstage/ownership.yaml)
- Ingested via root `catalog-info.yaml` Location `glorian-ownership-entities` (**URL** target only)
- Components / System / Soundcheck Resources set `spec.owner: group:glorian-control-plane-squad`
- Annotations: `eos.glorian/owner-squad`, `eos.glorian/owner-tribe`

## Discipline

1. Do **not** re-list `ownership.yaml` as a sibling `catalog.locations` entry (double ingestion).
2. Fleet posture remains `CONTROL_PLANE_ONLY` until live dogfood proves otherwise.
3. `AGENTS.md` is a generated snapshot from `eos xirp sync` / `compileXirpContext`, which reads `eos.glorian/owner-squad` and `eos.glorian/owner-tribe`. Catalog Groups remain authoritative for Backstage.
