# Contributing to EOS System

EOS (Engineering Operating System) is a sovereign, zero-external-dependency Node.js 22+ project. This guide gets you up and running in minutes.

---

## Getting Started

### Prerequisites

- **Node.js 22+** — required for native TypeScript stripping (`--experimental-strip-types`), built-in test runner, and `--experimental-test-coverage`. Check with `node --version`.
- **Git** — for cloning and hooks.

### Clone and run

```bash
git clone https://github.com/valentinflorezarbelaez-ai/Eos-System.git
cd Eos-System
```

No `npm install` is needed. EOS has **zero external runtime dependencies** (`"dependencies": {}`). Everything runs on Node.js built-ins.

Install the git hooks once:

```bash
npm run fleet:hooks
```

---

## Running Tests

### Full 7-stage CI gate (recommended before any PR)

```bash
npm test
# alias: npm run cicd:gate
```

This runs `scripts/verify-cicd-pipeline.mjs`, which executes all 7 stages:

| Stage | What it checks |
|-------|----------------|
| 1 | SAST — zero plaintext secrets, OWASP Top 10 |
| 2 | SDD Constitutional Gate (EARS + BDD + ADRs) |
| 3 | Hexagonal L0 purity + SLSA Level 4 SBOM SHA-256 |
| 4 | Static AST & bytecode verification (`node --check`) |
| 5 | WCAG 2.1 AA, SEO, and Web Performance Budget |
| 6 | In-process smoke test of all serverless endpoints |
| 7 | GitHub Actions + Vercel production CD + HTTP 200 probe |

### Individual test commands

```bash
npm run test:unit          # eosCore
npm run test:turbo         # eosTurbo
npm run test:graph         # eosSemanticGraph
npm run test:healer        # eosAutonomousHealer
npm run test:chaos         # chaosResilience
npm run test:prometheus    # eosPrometheus
npm run test:soul          # eosJarvisSoulIntrospection
npm run test:mcp:stream    # eosMcpStreamServer
npm run test:wasm          # eosWasmTopology
npm run test:apex          # eosApexModelRouter
npm run test:titans        # eosTitans
npm run test:spotify       # eosSpotify
npm run test:omega         # eosTierS1OmegaSdlc
npm run test:transcendental # eosOmegaTranscendentalApex
npm run test:refactor      # eosContinuousRefactorEngine
npm run test:loop          # eosSovereignLoop
npm run test:hnsw          # eosHnswVectorEngine
npm run test:ten           # eosApexTenMatrix
```

See `package.json` `"scripts"` for the full list.

### TypeScript strict-mode check

```bash
npm run typecheck
```

Runs `scripts/verify-typescript.mjs` — validates all `src/**/*.ts` files pass `tsc --strict --noEmit`.

### Coverage report

```bash
npm run test:coverage        # four core modules
npm run test:coverage:all    # every test/*.test.mjs file
```

Uses Node.js 22's built-in `--experimental-test-coverage` — no external tools needed.

---

## Adding a New Core Module

1. **Create the source file**

   ```
   src/core/eosYourModule.ts
   ```

   Export a named class or function. Keep the file in Layer-0 — no imports from `api/` or `src/components/`.

2. **Write the spec**

   ```
   openspec/specs/SPEC-NNN.md
   ```

   Use EARS (Event-driven, Autonomous, Reactive, State-driven) requirement patterns and BDD acceptance scenarios. Follow the numbering of existing specs (`SPEC-001.md`, `SPEC-002.md`, …).

3. **Write the tests**

   ```
   test/eosYourModule.test.mjs
   ```

   Use Node.js built-in `node:test` and `node:assert`. See `test/eosCore.test.mjs` for the canonical pattern.

4. **Register the test in the CI gate**

   Open `scripts/verify-cicd-pipeline.mjs` and add your test file to the list of tests that run in **Stage 6** (in-process verification). Search for the array or loop that lists test files, and append:

   ```js
   'test/eosYourModule.test.mjs',
   ```

5. **Add a convenience script to `package.json`** (optional but encouraged):

   ```json
   "test:yourmodule": "node --test test/eosYourModule.test.mjs"
   ```

6. Run `npm test` to confirm all 7 gates still pass.

---

## Adding a New MCP Tool

1. **Create the handler file**

   ```
   src/mcp/handlers/eosYourTool.ts
   ```

   Implement the `ToolHandler` interface:

   ```ts
   import type { ToolHandler } from '../types.js';

   export const eosYourTool: ToolHandler = {
     name: 'eos_your_tool',
     description: 'One-line description of what this tool does.',
     inputSchema: {
       type: 'object',
       properties: {
         param: { type: 'string', description: 'A required parameter' }
       },
       required: ['param']
     },
     async handle(args) {
       // implementation — no external deps
       return { result: 'value' };
     }
   };
   ```

2. **Register with `EosToolRegistry`**

   Open `src/mcp/eosMcpServer.ts` (or wherever `EosToolRegistry` is instantiated) and register the tool:

   ```ts
   import { eosYourTool } from './handlers/eosYourTool.js';
   registry.register(eosYourTool);
   ```

3. **Mirror the tool in `api/mcp.js`** so it is available on the serverless endpoint without a local server:

   Add the tool definition to the `TOOLS` array and a `case 'eos_your_tool':` branch inside `handleToolCall`.

4. Write a test in `test/eosMcpStreamServer.test.mjs` covering the new tool's happy path and at least one error case.

5. Run `npm test` to confirm the full gate passes.

---

## Commit Convention

EOS uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructure — no behaviour change |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Build scripts, CI config, tooling |

### Examples

```
feat(core): add eosHnswVectorEngine with cosine-similarity search

fix(api): handle missing query param in /api/graph fallback path

docs: add CONTRIBUTING.md and OpenAPI specification

refactor(mcp): extract tool handlers into individual files

perf(compile): switch SoA inner loop to 8-wide unroll for AVX-512

test(healer): add chaos injection scenario for heap-entropy spike

chore(ci): add test:coverage scripts to package.json
```

The pre-commit hook enforces that commit messages match the pattern. Run `npm run fleet:hooks` to install it.

---

## Architecture Rules

### Layer-0 purity

`src/core/` is the hexagonal domain core. It **must not** import from:

- `api/` — serverless handlers
- `src/components/` — UI layer
- any external npm package (zero external runtime deps)

The CI gate (Stage 3) enforces this automatically. If you introduce a cross-layer import, Stage 3 will fail with a detailed report of the offending edge.

### Zero external runtime dependencies

`package.json` has an empty (or absent) `"dependencies"` field. This is intentional and enforced by Stage 3 of the CI gate. Use Node.js built-ins (`node:fs`, `node:crypto`, `node:http`, etc.) exclusively.

Dev-only tooling (type definitions, formatters) may be added to `"devDependencies"` and never imported at runtime.

---

## CI Gates

| Stage | Script / Check | Common failure and fix |
|-------|----------------|------------------------|
| 1 SAST | Secret regex scan | Never commit raw API keys or tokens. Use environment variables. The `CICD_PAYLOAD_TEST` query param in `api/cicd.js` lets you test the scanner. |
| 2 SDD | EARS + BDD conformance | Add a `SPEC-NNN.md` for any new feature before writing code. The gate reads `openspec/specs/`. |
| 3 Hexagonal | Import graph + SBOM | Remove any cross-layer import or external `require`/`import`. Run `node --check src/core/*.ts` locally. |
| 4 AST | `node --check` on all `.ts` | Fix any syntax error reported. TypeScript strict violations caught by `npm run typecheck`. |
| 5 WCAG / CWV | Web perf budget | Check `scripts/verify-cwv-budget.mjs` thresholds. Compress assets, avoid layout shifts. |
| 6 Smoke | In-process endpoint tests | Run the failing test individually: `node --test test/eos<Module>.test.mjs`. |
| 7 CD | GitHub Actions + HTTP 200 | Usually passes automatically. If the Vercel deploy fails, check the Actions log and `VERCEL_TOKEN` secret. |

---

## Code Style

- **TypeScript strict mode** is required. `tsconfig.json` sets `"strict": true`. Run `npm run typecheck` before committing.
- **No `any`** except in documented exceptions. If you truly need `any`, add a comment explaining why: `// eslint-disable-next-line @typescript-eslint/no-explicit-any — Vercel handler type`.
- **Prefer `Result<T, E>` over `throw`** for domain errors. Use `throw` only for truly unexpected, unrecoverable conditions (programming errors). Domain failures (validation, not-found, parse errors) should return a typed result union.
- **No GC pressure in hot paths.** Pre-allocate `ArrayBuffer` arenas at module load time; avoid object allocation inside loops.
- **Branchless where possible.** Prefer lookup tables and bitwise operations over `if`/`else` chains in performance-critical code.
- **Every public function needs a JSDoc comment** — at minimum a one-liner describing what it does and what it returns.
