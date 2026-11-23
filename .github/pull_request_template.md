## Summary

<!-- One or two sentences describing what this PR changes and why. -->

## Type

<!-- Check one — must match the Conventional Commit type. -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `perf` — performance improvement
- [ ] `refactor` — code restructuring (no behavior change)
- [ ] `docs` — documentation only
- [ ] `test` — adding or fixing tests
- [ ] `build` — build system or dependencies
- [ ] `ci` — CI/CD configuration
- [ ] `chore` — maintenance

## Verification

<!-- Law III: Evidence Over Claims. Every PR must include executable evidence. -->

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm test` passes (7-stage SecDevOps pipeline, exit code 0)
- [ ] `npm run goal:validate` passes when this PR declares a Goal Contract

## Goal Contract (LIDR M7 / GDD)

<!-- Measurable Done — not prose. Vague goals fail closed. -->
<!-- Paste a yaml/json/goal fence OR link docs/goals/<GOAL-ID>.json|yaml -->
<!-- Agents MUST NOT rewrite check/tests/CI (protectedPaths) to go green. -->

```yaml
# TEMPLATE — fails schema until filled (GOAL-TODO / example_metric / trivial checks rejected).
id: GOAL-TODO
title: Replace with a measurable outcome
metric:
  name: example_metric
  unit: count
threshold:
  op: eq
  value: 0
check:
  command: "<replace with a real measurable check command>"
  timeoutMs: 30000
caps:
  maxAttempts: 3
  maxCostUsd: 5
protectedPaths:
  - test/**
  - .github/workflows/**
  - package.json
  - scripts/validate-gdd-goal.mjs
  - src/core/eosGoalDrivenDevelopmentContract.ts
  - src/core/eosGoalDrivenDevelopmentContract.types.ts
doneWhen: check exits 0 and <metric> satisfies threshold
```

- Goal file (optional): `docs/goals/`
- Validate: `npm run goal:validate` or `node scripts/validate-gdd-goal.mjs --pr-body <body.md>`

## Breaking Changes

<!-- If yes, describe the migration path. If no, delete this section. -->

- [ ] Breaking change (requires major version bump or migration guide)

## Related

<!-- Link to OpenSpecs, issues, or design docs. -->

- SPEC-XXX / BDD-XXX
