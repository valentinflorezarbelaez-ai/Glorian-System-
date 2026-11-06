# ADR-0002: Native Node.js TypeScript Type Stripping (no tsc compile step)

- Status: Accepted
- Date: 2026-10-26
- Deciders: Valentín Flórez Arbeláez

---

## Context

Node.js 22+ ships with `--experimental-strip-types`, which allows `.ts` files to
be executed directly by stripping type annotations at load time without a
separate compilation pass. Historically, TypeScript projects required one of:

- A `tsc` build step that emits `.js` files into a `dist/` directory.
- A runtime transpiler (`ts-node`, `tsx`, `esbuild`) added as a dependency.

Both approaches add friction:

- A `tsc` emit pipeline means every deploy must run a compile step, output must
  be committed or generated in CI, and source maps must be managed separately.
- Runtime transpilers are additional dependencies that contradict ADR-0001 (zero
  external runtime deps) or at minimum add to `devDependencies` with non-trivial
  startup overhead.

The EOS System runs on Node.js 22 both locally and on Vercel (runtime pinned to
`nodejs22.x`). The experimental flag is stable enough for production use at this
runtime version.

---

## Decision

TypeScript files (`.ts`) are **executed directly** by Node.js 22 via the
`--experimental-strip-types` flag. There is no `tsc --build` or `tsc --watch`
step in the run or deploy pipeline.

`tsc --noEmit` is invoked **only for type-checking** in CI at Stage 3.8 (static
analysis gate). It produces no output artifacts — its sole purpose is to fail the
build on type errors.

The `tsconfig.json` is configured with:
```json
{
  "compilerOptions": {
    "noEmit": true,
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

No `outDir` is set. No `.js` files are generated from source.

---

## Consequences

**Positive:**
- Simpler developer experience — `node --experimental-strip-types src/main.ts`
  just works.
- No `dist/` directory to manage, gitignore, or accidentally deploy stale
  artifacts from.
- Type errors are still caught in CI; the flag only strips annotations, it does
  not skip the type-checker.
- Vercel deployment uses the same runtime path; no build command required for
  Node-based functions.

**Negative / Trade-offs:**
- Requires Node.js 22+ strictly. Node 20 and below are unsupported.
- The `--experimental-strip-types` flag may change behavior across minor Node
  releases (mitigated by pinning the Node version in `.nvmrc` and Vercel config).
- Type-only features that require emit-time transforms (e.g., `const enum`,
  decorators with `emitDecoratorMetadata`) are not supported and must be avoided.
- Developers must understand that `tsc` is a linter here, not a compiler.

---

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| **Full `tsc --build` pipeline** | Adds a compile step to every dev/deploy cycle; requires managing `dist/` artifacts; increases CI time. |
| **esbuild** | External dependency (violates ADR-0001 spirit for dev tooling); adds bundle configuration overhead. |
| **ts-node** | External `devDependency`; slower startup than native strip-types; effectively unmaintained in favor of `tsx`. |
| **tsx** | External `devDependency`; same concerns as ts-node; adds a binary the system does not need given Node 22 native support. |
| **Babel with `@babel/preset-typescript`** | Heavyweight; introduces an entire transpiler ecosystem; no type-checking capability. |
