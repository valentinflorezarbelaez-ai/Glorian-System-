# ADR-0004: Hexagonal (Clean) Architecture with Layer-0 Domain Purity

- Status: Accepted
- Date: 2026-10-26
- Deciders: Valentín Flórez Arbeláez

---

## Context

As the EOS System grew, import paths began crossing architectural boundaries:
domain logic in `src/core/` imported from `api/` route handlers to reuse
validation helpers; UI components reached into infrastructure services for
configuration. These boundary violations caused:

- **Test brittleness** — unit tests for domain logic required spinning up HTTP
  servers or mocking file-system infrastructure.
- **Circular dependencies** — TypeScript would silently resolve circular imports,
  producing `undefined` at runtime in non-obvious ways.
- **Deployment coupling** — a change to an `api/` handler could break `src/core/`
  logic, making it impossible to deploy the domain layer independently.
- **Reasoning difficulty** — understanding what a domain function does required
  chasing imports across the entire tree.

The hexagonal architecture (also called Ports & Adapters) solves this by defining
strict dependency rules: inner layers are unaware of outer layers. The domain is
the innermost layer.

---

## Decision

Layer boundaries are defined and **CI-enforced** by `eosArchitectureGuard.ts`:

```
DOMAIN (src/core/)
  ↑ depended on by
APPLICATION (src/mcp/, src/services/)
  ↑ depended on by
INFRASTRUCTURE (api/, src/db/, src/adapters/)
  ↑ depended on by
PRESENTATION (src/components/, src/ui/, src/pages/)
```

**Enforcement rules (fail-closed):**
- `src/core/**` MUST NOT import from `api/**`, `src/components/**`, `src/ui/**`,
  `src/pages/**`, or any path outside `src/core/` and `src/shared/`.
- `src/mcp/**` and `src/services/**` MUST NOT import from `api/**` or
  presentation layers.
- `api/**` MAY import from any layer (it is the outermost adapter).

`eosArchitectureGuard.ts` is executed as a standalone script in **CI Stage 1**
(the same gate as the no-runtime-deps check). It parses `import` statements
statically and exits non-zero on any violation. The CI pipeline blocks merge on
any failure.

Domain layer (`src/core/`) depends only on:
- TypeScript built-in types
- `src/shared/` (pure value types, `Result<T,E>`, `ContractError`)
- `node:crypto` for hashing primitives (no I/O)

---

## Consequences

**Positive:**
- Domain logic is **100% unit-testable** without any infrastructure mock.
- Architectural regressions are caught automatically in CI, not in code review.
- New contributors get a hard guardrail rather than a soft guideline.
- The domain can be extracted into a standalone package in the future with zero
  refactoring.

**Negative / Trade-offs:**
- Strict boundaries require more boilerplate: infrastructure concerns (e.g.,
  reading a file) must be passed into domain functions as injected ports rather
  than called directly.
- Developers unfamiliar with hexagonal architecture have an initial learning
  curve.
- `eosArchitectureGuard.ts` must be maintained as new directories are added to
  the project.

---

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| **Layered MVC (Model-View-Controller)** | Framework coupling; controllers typically reach directly into models, creating the same boundary violations this ADR prevents. |
| **Microservices** | Extreme operational complexity for a solo-operated system; network I/O between services introduces latency and failure modes that don't exist in a monolith. |
| **Informal conventions ("just don't import across layers")** | Not enforceable; relies on review discipline; proven to erode over time in practice. |
| **ESLint `import/no-restricted-paths`** | Viable enforcement mechanism, but introduces an ESLint devDependency. `eosArchitectureGuard.ts` does the same job with zero deps using Node's `fs` and a regex walk. |
