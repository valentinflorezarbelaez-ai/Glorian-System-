---
name: gdd-contract
description: >
  Goal-Driven Development (LIDR M7) contract harness: measurable goals with
  metric + threshold + check, attempt/cost caps, and fail-closed protection
  against rewriting tests/CI/check to pass. Trigger: when defining Done for a
  PR, validating docs/goals/*, or enforcing builder≠verifier on agent loops.
license: Apache-2.0
metadata:
  author: glorian-system
  version: "1.0"
---

## Purpose

Executable GDD — not prose. Every tracked goal must declare a measurable Done
condition that an agent cannot silently move.

## Required goal schema

```yaml
id: GOAL-L0-DEPS
title: Layer-0 runtime dependency count stays at zero
metric:
  name: runtime_dependencies_count
  unit: count
threshold:
  op: eq
  value: 0
check:
  command: node -e "const p=require('./package.json'); process.exit(Object.keys(p.dependencies||{}).length===0?0:1)"
  timeoutMs: 30000
caps:
  maxAttempts: 3
  maxCostUsd: 5
protectedPaths:
  - test/**
  - .github/workflows/**
  - package.json
  - scripts/validate-gdd-goal.mjs
doneWhen: check exits 0 and runtime_dependencies_count eq 0
```

Vague titles / descriptions without `metric` + `threshold` + `check` are
**rejected fail-closed**. Template ids (`GOAL-TODO`, `GOAL-EXAMPLE`, …),
placeholder metric names, and trivial `process.exit(0)` checks also fail closed.

## Agent rules (anti-traps)

1. **Do not rewrite the bar** — never edit `check.command`, files under
   `protectedPaths` (tests, CI workflows, the validator, package.json scripts
   that define the gate) to manufacture a green result.
2. **Respect caps** — stop and report when `maxAttempts` or `maxCostUsd` is
   exceeded.
3. **Builder ≠ verifier** — implementation agents must not author or weaken
   the goal check; verification stays independent (`npm run goal:validate`,
   `npm run verify:strict`).

## Commands

```bash
# Validate all fixtures
npm run goal:validate

# Validate one file
node scripts/validate-gdd-goal.mjs docs/goals/GOAL-L0-DEPS.json

# Extract + validate a fenced goal from a PR body markdown file
node scripts/validate-gdd-goal.mjs --pr-body /tmp/pr-body.md
```

## PR wiring

PR template includes a **Goal Contract** section. Paste a `yaml`/`json`/`goal`
fence that satisfies the schema, or link a file under `docs/goals/`.

## Layer-0

Core harness: `src/core/eosGoalDrivenDevelopmentContract.ts` — zero new npm
dependencies. Contract tests: `test/eosGoalDrivenDevelopmentContract.test.mjs`.
