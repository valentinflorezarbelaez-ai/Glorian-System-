# Dependabot Major Upgrade Policy (Won’t-Fix Window)

<!-- Epistemic: POLICY_SEALED · majors lifted 2026-11-24 after migration exit criteria -->

## Decision (2026-11-10 → lifted 2026-11-24)

ESLint 10 / `@eslint/js` 10 / `eslint-plugin-n` 18 and `@types/node` 26 majors were **won’t-fix** on `main` until **2026-12-15**. Exit criteria were met on the migration branch; the window is **lifted**.

| Package              | Prior Dependabot PRs | Status                         | Notes                                                                 |
| -------------------- | -------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `eslint` 10          | #599                 | LIFTED — on `main` via #628 PR | Flat-config + `no-useless-assignment` adopted; Node 22/24 CI green    |
| `@eslint/js` 10      | #600                 | LIFTED — coupled to ESLint 10  | Same migration                                                        |
| `eslint-plugin-n` 18 | #601                 | LIFTED — peer range OK         | Optional peers (`typescript`, `ts-declaration-location`) not required |
| `@types/node` 26     | #602                 | LIFTED                         | Engines stay `>=22.18.0 <25` (Node 24 LTS); types may lead engines    |

## Enforcement (post-lift)

1. `.github/dependabot.yml` no longer ignores semver-major for the packages above.
2. Historical closed major PRs remain closed; do not reopen — tip is the migration PR that closes #628.
3. Tracking issue [#628](https://github.com/valentinflorezarbelaez-ai/Glorian-System-/issues/628) closes with the migration merge receipt.

## Exit criteria (satisfied)

- Dedicated migration branch with `npm run verify:strict` + 7-stage CI green on Node 22 and 24.
- No Layer-0 `dependencies: {}` regression (`dependencies` absent / empty; runtimeDependenciesCount = 0).
- Lint semantics note: ESLint 10 recommended enables `no-useless-assignment`; call sites cleaned (see `openspec/changes/deps-eslint10-types-node26/`).

Epistemic label: `VERIFIED_WITHIN_TESTED_SCOPE` for these majors on Node 22/24 after green CI.

## Prep log (2026-11-16)

- Tracking issue: [#628](https://github.com/valentinflorezarbelaez-ai/Glorian-System-/issues/628).
- Non-major Dependabot PRs `#637` / `#638` closed 2026-11-16 as stale tips.
- Migration branch checklist executed 2026-11-24 (user-authorized early lift ahead of 2026-12-01 prep window).
