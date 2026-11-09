# GitHub Copilot Custom Instructions — Glorian System

<!-- Copilot reads this file to understand the project context, conventions,
     and constraints before generating suggestions. This is the Microsoft/
     Google standard for AI-assisted coding in large codebases. -->

## Project Overview

Glorian System is a **sovereign software engineering control plane** — a monorepo
of Layer-0 TypeScript engines, a Node.js CLI, an MCP server, and Vercel
serverless functions for engineering governance. Zero runtime dependencies.

## Critical Rules (7 Inviolable Laws)

1. **Law I** — No code without a spec. Consult `docs/specs/spec.md` first.
2. **Law II** — No secrets in source. Never commit credentials.
3. **Law III (V)** — **Zero external runtime dependencies** in `src/core/`. Only
   `node:` built-in modules and relative imports to other `src/core/` files.
4. **Law IV** — Read-only fleet boundary. Never write to sibling repos.
5. **Law VI** — Cryptographic receipt for every quality assertion.
6. **Law VII** — Deterministic, reproducible verification. No wall-clock or
   network dependence in tests.

## Code Conventions

- **TypeScript**: strict mode, `NodeNext` module resolution, `noEmit: true`
  (Node.js strip-only — no compilation to JS).
- **Imports**: use `node:fs` not `fs`. Use `.ts` extensions in imports.
- **Naming**: `eosCamelCase` for classes/functions, `eos_PascalCase` for types.
- **No `any`**: the TypeScript compiler is in strict mode. Use proper types.
- **Testing**: Node.js built-in test runner (`node --test`). No Jest/Vitest.
- **Formatting**: Prettier with 2-space indent, 120 char width, double quotes.
- **Commits**: Conventional Commits enforced by `.githooks/commit-msg`.

## Architecture

- `src/core/` — Layer-0 pure TypeScript engines (zero deps, import only node: or ./)
- `src/mcp/` — MCP server (stdio + HTTP/SSE)
- `bin/eos.mjs` — CLI entry point (60+ subcommands)
- `api/` — Vercel serverless functions
- `test/` — 160+ `.test.mjs` files with Node.js built-in runner
- `docs/formal/` — TLA+ formal specifications
- `scripts/` — CI/CD pipeline scripts (all zero-dep)

## What Copilot Should Do

- Suggest `node:` prefixed imports for all Node.js built-in modules.
- Always add JSDoc comments for exported functions.
- Prefer `const` over `let`. Never use `var`.
- Use template literals over string concatenation.
- Add input validation at function boundaries (bounded inputs, fail-closed).
- Generate tests that are deterministic (no `Date.now()`, no `Math.random()`).
- Respect the layer isolation: `src/core/` imports only from `node:` or `./`.

## What Copilot Should NOT Do

- Never suggest `import _ from "lodash"` or any external package for `src/core/`.
- Never use `any` type — suggest proper type annotations instead.
- Never suggest `console.log` in `src/core/` modules (use structured logging).
- Never suggest non-deterministic patterns in tests.
- Never suggest `@ts-ignore` or `@ts-expect-error` without a justified comment.
