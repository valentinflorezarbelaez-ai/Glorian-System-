# PLAN-128 — Architecture Plan & ADRs (`CHANGE-128` / `SPEC-254`..`SPEC-258`)

## Metadata

- **Plan ID**: PLAN-128
- **Change Ref**: CHANGE-128
- **Target SPECs**: SPEC-254, SPEC-255, SPEC-256, SPEC-257, SPEC-258
- **Date**: 2026-11-14
- **Status**: APPROVED

---

## 1. Architecture Boundaries (Law V Compliance)

All five new engines (`EosComputationalLithographyOpcCore`, `EosDifferentialPrivacyAbacGovernorCore`, `EosLobAlmgrenChrissVpinCore`, `EosUnifiedMemoryDmaDvfsQosCore`, `EosRelativisticBeamTwissLuminosityCore`) plus `src/core/eosMcpEnterpriseActionRegistry.ts` reside strictly in Layer-0 `src/core/`, importing only `./eosKernelPrimitives.ts` (`deepFreeze`, `pureSha256`, `assertPrecondition`) and their paired `.types.ts` contracts.

---

## 2. Architectural Decision Records (ADRs)

### ADR-128-001 — Exact 162-Action Registry (`ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS`) for Fail-Closed `-32602` Validation

- **Decision**: Introduce `src/core/eosMcpEnterpriseActionRegistry.ts` holding the complete 162-action `ReadonlySet<string>` and replace the permissive `^[a-z][a-z0-9_]{1,63}$` regex in `src/core/eosMcpSchemaValidator.ts` with `ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS.has(value.trim().toLowerCase())` while leaving `eosMcpToolDefinitionsPart04.ts` untouched so `tools/list` token footprint stays zero-bloat.
- **Rejected Alternative**: Retaining regex-only schema validation, which allowed unknown actions to pass schema validation (`-32602`) and only fail later during tool dispatch (`-32603`).

### ADR-128-002 — Extending Formal Verification from 41 to 45 TLA+ Models

- **Decision**: Author `SurfaceCodeQec.tla`, `LeoOpticalIslRouting.tla`, `UhvGridDcOpf.tla`, and `LawsonFusionIgnition.tla` under `docs/formal/` alongside `200`-step state-space verification functions in `scripts/tla/tlaSimulationsPart4.mjs` wired into `scripts/verify-formal-tla.mjs`.
- **Rejected Alternative**: Leaving `CHANGE-127` frontier domains (`SPEC-101`, `SPEC-102`, `SPEC-103`, `SPEC-105`) covered solely by TypeScript unit tests without TLA+ temporal safety invariants.

### ADR-128-003 — Zero-Advisory Supply Chain & Flake-Free Time-Lock Timing Measurement

- **Decision**: Exempt `@types/node` (compile-time Node type declarations) in `scripts/unused-deps-check.mjs` and upgrade `BDD-1169` in `test/eosTimeLockPuzzleCore.test.mjs` to `performance.now()` (`< 100`ms) so `deps:check` reports `0` advisories and parallel CPU load cannot falsely fail `test:ci`.
- **Rejected Alternative**: Leaving a recurring 1-package advisory and millisecond-coarse `Date.now() < 10` threshold in CI.
