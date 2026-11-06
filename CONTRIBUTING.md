# Contributing

## Prerequisites

- Node.js 22 or newer (CI runs 22 and 24).
- Git. Go and Rust toolchains are only needed for the template jobs.

## Setup

```bash
npm ci --ignore-scripts
node scripts/quickstart.mjs
```

The project has zero runtime dependencies; devDependencies are the TypeScript toolchain only.

## Before you open a pull request

1. Link an issue or an OpenSpec change. Do not open a PR without a governing record.
2. Run the full gate: `CI=true npm run verify:strict` (7 stages, every discovered suite).
3. Run the coverage floor: `npm run test:coverage`.
4. Run the hygiene ratchet: `npm run hygiene`.
5. Run the architecture fitness function: `npm run arch:verify`.
6. If you touched a shared subsystem, run its suite directly:
   `node --test test/<suite>.test.mjs`.

Tests must be hermetic: no fixed ports, no external network, no wall-clock SLA. Use ephemeral
ports (`port 0`) and generous hang guards; performance budgets belong in benchmarks.

## Architecture boundaries

`npm run arch:verify` enforces the import graph as a fitness function:

- `R1` shipping code (`src/`, `bin/`, `scripts/`) imports only `node:` builtins and relative files.
- `R2` `src/core` (Layer 0) never depends on `src/mcp`, `src/ui`, `src/components` or `src/native`.
- `R3` the `src/` import graph stays acyclic.
- `R4` `src/` never imports `scripts/` or `test/`.
- `R5` every relative import resolves to a real file.

The `LAYER_ALLOWLIST` in `scripts/verify-architecture-boundaries.mjs` is currently empty.
If a change ever needs a temporary exception, pin the exact `source -> target` pair and delete
it in the same change that removes the edge. Do not grow the allowlist.

## Commit and PR conventions

- Conventional Commits: `feat(scope):`, `fix(scope):`, `chore(scope):`, `docs(scope):`.
- Keep commits focused; do not mix refactors with behavior changes.
- Never force-push `main` or bypass hooks. Revert with a new commit.
- Fill the pull request template, including the verification checklist and rollback plan.

## Security

- Never commit credentials, tokens, or customer data. `npm run secret-scan` runs in stage 1.
- Report vulnerabilities privately per [SECURITY.md](SECURITY.md), not in a public issue.
- Changes to `.github/workflows/` must keep actions pinned to 40-hex SHAs; BDD-269 enforces it.

## Documentation

- Architecture and glossary: [ARCHITECTURE-S0.md](ARCHITECTURE-S0.md), [DESIGN.md](DESIGN.md).
- Operational procedures: [docs/operations/RUNBOOK.md](docs/operations/RUNBOOK.md).
- Incident policy: [docs/operations/INCIDENT_RESPONSE.md](docs/operations/INCIDENT_RESPONSE.md).
- Specs live in `openspec/specs/`; plans in `docs/plans/`.

Do not weaken assertions, lower coverage floors, or raise hygiene budgets to make a build pass.
Fix the fixture, the hermeticity, or the product behavior.
