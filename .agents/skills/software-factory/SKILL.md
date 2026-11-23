---
name: software-factory
description: >
  Optional LIDR software-factory orchestration outside Layer-0: isolated git
  worktrees, Plan≠Execute (compose sdd-* / gdd-contract), adversarial review
  via judgment-day, attempt caps, and evidence via npm run verify:strict.
  Trigger: when user says "software factory", "/factory", "factory skill",
  "worktree factory", or asks to run parallel Plan→Apply with builder≠verifier.
license: Apache-2.0
metadata:
  author: glorian-system
  version: "1.0"
---

## Purpose

Thin **orchestration** skill. Do **not** reinvent SDD, GDD, PR, or adversarial
review — compose the skills already in `.agents/skills/`:

| Phase | Delegate to |
| --- | --- |
| Issue / intake | `issue-creation` |
| Measurable Done | `gdd-contract` |
| Plan track | `sdd-explore` → `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-tasks` |
| Apply track | `sdd-apply` (separate agent / worktree from planner) |
| Verify | `sdd-verify` + `npm run verify:strict` |
| Adversarial review | `judgment-day` (builder ≠ verifier) |
| PR | `branch-pr` |

Layer-0 GDD / factory engines (`eos toolchain:gdd:*`, SPEC-378) remain the
deterministic harness. This skill is the agent-facing playbook only.

## When to Use

- Parallel or high-blast-radius changes that need worktree isolation
- Explicit factory / Plan→Apply / adversarial-review requests
- Any loop that must stop on attempt caps instead of rewriting the bar

**Do not use** for tiny one-file docs/typo edits on the current branch — use
Fast-Track / `branch-pr` directly.

## Critical Patterns

### Pattern 1: Worktree isolation

1. Create a dedicated worktree under `.worktrees/` (gitignored):

```bash
node scripts/software-factory-worktree.mjs create \
  --branch cursor/<slug> \
  --base main
```

2. All Apply / Fix edits happen **inside** that worktree path.
3. Tear down when done (or on abort):

```bash
node scripts/software-factory-worktree.mjs remove --branch cursor/<slug>
# If create used --path <slug>, pass the same --path on remove (or omit
# --path and let remove look up the registered worktree for the branch).
node scripts/software-factory-worktree.mjs remove --branch cursor/<slug> --path <slug>
```

Fail-closed: the helper refuses paths outside `.worktrees/`, empty/unsafe
branch names, and dirty removes without `--force`.

Prefer `node bin/eos.mjs worktree list` / Layer-0 orchestrator for fleet-scale
ops; this script is a zero-deps convenience for the agent skill path.

### Pattern 2: Plan ≠ Execute

1. **Plan agents** may write proposals, specs, design, and tasks only.
2. **Apply agents** implement from frozen tasks/specs; they must not author or
   weaken the goal check, tests, or CI (`gdd-contract` protected paths).
3. Switch models / agents at the Plan → Apply → Verify boundary (token economy).
4. Never let the same agent both implement and certify (`builder ≠ verifier`).

### Pattern 3: Adversarial review (reuse judgment-day)

Before opening or merging a factory PR:

1. Run `judgment-day` on the factory diff / target files.
2. Max **2** fix iterations (judgment-day rule); then escalate to the human.
3. Confirmed CRITICAL findings block merge; warnings/suggestions are advisory.

### Pattern 4: Stop conditions / attempt caps

Halt and report when any of these fire:

| Cap | Default | Action |
| --- | --- | --- |
| `maxAttempts` | 3 (from goal contract) | Stop loop; publish probe ledger |
| Judgment-day fix rounds | 2 | `JUDGMENT: ESCALATED` |
| `verify:strict` | must exit 0 | Do not open/merge PR red |
| Vague goal | fail-closed | Refuse to start Apply |

Do **not** edit `check.command`, tests, or CI to manufacture green.

### Pattern 5: Evidence (Law III)

Before PR / merge:

```bash
npm run verify:strict   # 7/7 stages, exit 0
npm run goal:validate   # when a Goal Contract is declared
```

Record exit codes and paths in the PR Verification section. Claims without
executable evidence are invalid.

## Decision Tree

```
Factory request
│
├── Scope tiny / single file? → skip factory; Fast-Track + branch-pr
│
▼
Ensure measurable Done (gdd-contract) — refuse vague goals
▼
Create worktree (software-factory-worktree.mjs create)
▼
PLAN track (sdd-explore → propose → spec → design → tasks) — no Apply yet
▼
APPLY track in worktree (sdd-apply) — separate agent from planner
▼
VERIFY (sdd-verify + verify:strict) — exit 0 required
▼
judgment-day (builder ≠ verifier)
│
├── APPROVED → branch-pr → merge when CI green
└── ESCALATED / caps hit → stop + report (no infinite loops)
▼
remove worktree
```

## Output Format

```markdown
## Software Factory — {change-name}

- Worktree: `.worktrees/{branch-slug}`
- Goal: {GOAL-ID or link} (maxAttempts={N})
- Plan artifacts: {paths or engram keys}
- Apply agent ≠ Plan agent: yes
- verify:strict: exit {code}
- judgment-day: APPROVED | ESCALATED
- PR: {url or pending}
- Stop reason (if any): {caps / escalation}
```

## Rules

- Compose existing skills; do not copy their full protocols into this file.
- Stay outside Layer-0: no new `package.json` runtime dependencies; do not
  mutate `src/core/` for this skill itself.
- English for all technical artifacts (Law VII).
- Prefer one factory wave per disjoint edit surface; never share a dirty
  worktree across parallel Apply agents.

## Commands

```bash
# Worktree helper (zero npm deps, fail-closed)
node scripts/software-factory-worktree.mjs list
node scripts/software-factory-worktree.mjs create --branch cursor/example --base main
node scripts/software-factory-worktree.mjs remove --branch cursor/example
node scripts/software-factory-worktree.mjs remove --branch cursor/example --path custom-slug

# Evidence
npm run verify:strict
npm run goal:validate
```
