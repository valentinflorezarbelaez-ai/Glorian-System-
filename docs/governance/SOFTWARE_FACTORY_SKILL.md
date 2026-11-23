# Software Factory Skill (LIDR — optional, outside Layer-0)

Agent-facing orchestration for isolated worktrees, Plan≠Execute, adversarial
review, and attempt caps. **Not** a Layer-0 runtime module.

| Artifact | Path |
| --- | --- |
| Skill | `.agents/skills/software-factory/SKILL.md` |
| Worktree helper | `scripts/software-factory-worktree.mjs` |
| Composed skills | `sdd-*`, `gdd-contract`, `judgment-day`, `issue-creation`, `branch-pr` |
| Deterministic GDD harness | `eos toolchain:gdd:*` / SPEC-378 (Layer-0) |

## Invariants

- `package.json` `"dependencies": {}` stays empty.
- Factory skill does not import or extend `src/core/`.
- Evidence gate remains `npm run verify:strict` (exit 0).

See also: `.agents/skills/eos-sdd-pipeline/SKILL.md` §6 (GDD & parallel factory).
