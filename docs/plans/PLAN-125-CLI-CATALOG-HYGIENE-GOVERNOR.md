# PLAN-125 — Architecture Plan & ADRs (`CHANGE-125` / `SPEC-250`)

## Metadata

- **Plan ID**: PLAN-125
- **Change Ref**: CHANGE-125
- **Target SPEC**: SPEC-250
- **Date**: 2026-11-13
- **Status**: APPROVED

---

## 1. Architecture Boundaries (Law V Compliance)

Module 65 (`EosCliCatalogAndHygieneGovernorCore`) resides in `src/core/eosCliCatalogAndHygieneGovernorCore.ts` alongside pure type contracts in `.types.ts`, using only `node:crypto`, `node:fs`, `node:path`, and `./eosKernelPrimitives.ts` (`deepFreeze`). Zero external runtime dependencies are introduced.

---

## 2. Architectural Decision Records (ADRs)

### ADR-125-001 — Separate CLI Help Catalog Module (`bin/commands/cliHelpCatalog.mjs`)

- **Decision**: Extract `QUICK_HELP_TEXT` and `EXHAUSTIVE_HELP_TEXT` from `bin/commands/cliKernel.mjs` into `bin/commands/cliHelpCatalog.mjs` so CLI help copy can be maintained cleanly at 100% parity without bloating command dispatch logic.
- **Rejected Alternative**: Continuing to append help lines inside `cliKernel.mjs`, which would breach the `800`-line hard limit and risk accidental truncation.

### ADR-125-002 — Tiered Decompression Across Sandbox, Tracing, CLI, & MCP Handlers

- **Decision**: Move pure interfaces into `.types.ts` (`eosContainerSandbox.types.ts`, `eosOtelDistributedTracing.types.ts`), compact banner output in `cliFrontierMesh.mjs`, trim verbose header comments in `eosMcpServer.ts`, and delegate `crdt_*`/`mmr_*`/`vss_*` dispatch helpers into `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts`, keeping every module `<= 788` lines (`>= 12` lines headroom below `800`) without changing public imports or MCP tool contracts.
- **Rejected Alternative**: Raising `size-budget.json` ceilings above `800` lines, which weakens maintainability discipline.

### ADR-125-003 — Continuous Layer-0 Parity & Headroom Auditing (`SPEC-250`)

- **Decision**: Expose `EosCliCatalogAndHygieneGovernorCore` both programmatically (`./hygiene-governor`), via CLI (`hygiene:audit` + `ship` integration), and via MCP (`cli_hygiene_audit`) so future CLI or module additions are verified automatically.
- **Rejected Alternative**: One-off manual scripts detached from Layer-0 core verification and `ship`.
