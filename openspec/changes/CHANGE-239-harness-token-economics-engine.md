# CHANGE-239: Harness Boundaries, Structured Token Economics & Deterministic Decision Router Engine

- **Spec Reference**: `SPEC-377`
- **Intake Reference**: `INTAKE-239`
- **Plan Reference**: `PLAN-239`
- **Tasks Reference**: `TASKS-239`
- **Status**: `APPROVED`
- **Date**: 2026-11-22

## Summary of Change

Introduces five native Layer-0 primitives synthesizing LIDR Modules M5 (Harness Engineering) and M6 (Token Economics) under Big Tech zero-dependency standards:

1. `src/core/eosHarnessTokenEconomicsCore.types.ts` — Pure domain contracts, glob/path boundary matcher, token estimator, and deterministic hashing helpers.
2. `src/core/eosHarnessTokenEconomicsCore.ts` — Declarative Harness Forbidden-Touch Enforcer, Headroom-style MCP/JSON columnar payload compressor, JEV-style closed-set decision classifier with milestone-boundary prompt-cache-safe routing, Prompt Cache Prefix Stability & Session Economics Auditor, and Ponytail/Caveman Anti-Overengineering Gate + Compact Agent IPC Encoder.
3. `docs/formal/HarnessTokenEconomics.tla` & `.cfg` — Formal TLA+ safety specification (Model 120) verifying forbidden-touch containment, cache-safe milestone switching, and deterministic audit invariants.
4. `bin/commands/cliHarnessTokenEconomics.mjs`, `cliToolchainRouter.mjs`, `cliHelpCatalog.mjs` — CLI surfaces under `toolchain:token-econ:*`.
5. Phase-8 MCP audit tool `eos_harness_token_economics_audit` and `.agents/skills/eos-sdd-pipeline/SKILL.md` Section 5 operationalization.
6. Comprehensive BDD test suite `test/eosHarnessTokenEconomicsCore.test.mjs` (`BDD-2049..BDD-2056`).
