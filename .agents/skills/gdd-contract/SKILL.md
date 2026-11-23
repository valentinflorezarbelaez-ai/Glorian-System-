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
id: GOAL-EXAMPLE
title: Short measurable outcome
metric:
  name: snake_case_metric
  unit: count|percent|exit_code|ms|usd
threshold:
  op: eq|neq|lte|gte|lt|gt
  value: 0
check:
  command: node -e "process.exit(0)"
  timeoutMs: 30000
caps:
  maxAttempts: 3
  maxCostUsd: 5
protectedPaths:
  - test/**
  - .github/workflows/**
  - package.json
  - scripts/validate-gdd-goal.mjs
doneWhen: check exits 0 and metric satisfies threshold
```

Vague titles / descriptions without `metric` + `threshold` + `check` are
**rejected fail-closed**.

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
