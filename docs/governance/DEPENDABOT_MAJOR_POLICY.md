# Dependabot Major Upgrade Policy (Won’t-Fix Window)

<!-- Epistemic: POLICY_SEALED · revisit required before PRODUCTION_READY claims on toolchain majors -->

## Decision (2026-11-10)

ESLint 10 / `@eslint/js` 10 / `eslint-plugin-n` 18 and `@types/node` 26 majors remain **won’t-fix** on `main` until **2026-12-15**.

| Package              | Open Dependabot PRs | Status                    | Rationale                                                             |
| -------------------- | ------------------- | ------------------------- | --------------------------------------------------------------------- |
| `eslint` 10          | #599                | WONT_FIX_UNTIL_2026-12-15 | Node 22/24 CI matrix fails flat-config migration; keep ESLint 9 green |
| `@eslint/js` 10      | #600                | WONT_FIX_UNTIL_2026-12-15 | Coupled to ESLint 10                                                  |
| `eslint-plugin-n` 18 | #601                | WONT_FIX_UNTIL_2026-12-15 | Coupled to ESLint 10 peer range                                       |
| `@types/node` 26     | #602                | WONT_FIX_UNTIL_2026-12-15 | Types ahead of engines; Node 24 LTS types stay on `@types/node` 24.x  |

## Enforcement

1. `.github/dependabot.yml` ignores semver-major for the packages above through the revisit date.
2. Open major PRs are closed with a comment linking this policy (not merged, not silent).
3. Revisit issue MUST be opened on or before **2026-12-15** titled `[deps] Revisit ESLint 10 + @types/node 26 majors`.

## Exit criteria to lift won’t-fix

- Dedicated migration branch with `npm run verify:strict` + 7-stage CI green on Node 22 and 24.
- No Layer-0 `dependencies: {}` regression.
- ADR or delta-spec note under `openspec/` if lint semantics change.

Epistemic label until exit criteria: `WONT_FIX_UNTIL_2026-12-15` (not `VERIFIED` for majors).

## Prep log (2026-11-16)

- Tracking issue: [#628](https://github.com/valentinflorezarbelaez-ai/Glorian-System-/issues/628) — OPEN through revisit date.
- Non-major Dependabot PRs held (7-stage SecDevOps FAIL on Node 22/23 matrix): `#637` (dev-deps group), `#638` (github-actions group). Do not merge until 7-stage is green.
- Majors remain closed under won’t-fix; no migration branch opened yet — start `deps/eslint10-types-node26` after 2026-12-01 with exit criteria above.
