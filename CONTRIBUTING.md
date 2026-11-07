# Contributing to Glorian System

Thanks for your interest in improving Glorian System (formerly EOS System).

## Prerequisites

- **Node.js >= 22** (see `engines` in `package.json`; `.npmrc` sets `engine-strict=true`, so an unsupported runtime fails the install).
- **Git**.

## Setup

1. Fork and clone the repository.
2. `npm ci` — installs the exactly pinned toolchain (`typescript`, `eslint`, `@types/node`, etc.) **and automatically configures the versioned Git hooks** via the `prepare` lifecycle script. Do not use `npm install`; CI installs with `npm ci` from the lockfile.

> The `prepare` script runs `git config core.hooksPath .githooks` for you. No manual step needed.

**Alternatively**, open in GitHub Codespaces — the `.devcontainer/devcontainer.json` provisions the full environment (Node 24, Go 1.24, Rust, Java 21 + TLC) automatically.

## The gate is the contract

Every change must pass the 7-stage SecDevOps pipeline:

```sh
npm run check     # typecheck + lint + full test suite
npm test          # == npm run verify:strict == npm run cicd:gate (tests only)
```

The fast lane (`pre-commit`) runs `npm run verify:fast` (credential scan, type-check, impacted suites). The full gate runs on `pre-push` and in CI.

## Linting & Formatting

ESLint (flat config, `@eslint/js`) is enforced in CI and via the pre-commit hook:

```sh
npm run lint          # check
npm run lint:fix      # auto-fix safe violations
```

Prettier (3.x) enforces consistent formatting. The `.prettierrc.json` matches the `.editorconfig`:

```sh
npm run format         # auto-format all files
npm run format:check   # verify formatting (CI gate)
```

Key rules enforced:

- `n/prefer-node-protocol` — `node:fs` over `fs` in all scripts.
- 2-space indent, LF line endings, trailing commas, 120-char print width.
- Templates (`templates/`) are self-contained sub-projects with their own tooling and are excluded from lint/format.

## Inviolable laws

- **Law III / V — zero external runtime dependencies.** `package.json` `dependencies` must stay empty. Only pinned `devDependencies` are allowed.
- **Law II — no secrets in source.** Never commit credentials; the secret-scan stage blocks them.
- **Law VII — deterministic verification.** No wall-clock or network dependence in tests; use generous sanity ceilings, not tight timing budgets.

## Commits

Conventional Commits are enforced by `.githooks/commit-msg`:

```
<type>(<scope>): <subject>
```

`<type>` is one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Specs (spec-driven development)

Formal specs live in `openspec/specs/` and active changes in `openspec/changes/`. Link changes to the relevant `SPEC-`/`BDD-` identifiers where one exists.

## Security

Report vulnerabilities privately per [SECURITY.md](SECURITY.md). Do not open public issues for security findings.

## Code of Conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
