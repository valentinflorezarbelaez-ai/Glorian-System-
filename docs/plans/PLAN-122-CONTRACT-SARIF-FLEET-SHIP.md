# PLAN-122 — Architecture Plan & ADRs (`CHANGE-122` / `SPEC-241`..`SPEC-243`)

## Metadata

- **Plan ID**: PLAN-122
- **Change Ref**: CHANGE-122
- **Target SPECs**: SPEC-241, SPEC-242, SPEC-243
- **Date**: 2026-11-13
- **Status**: APPROVED

---

## 1. Architecture Boundaries (Law V Compliance)

All three new modules (`EosApiContractSemanticDiffCore`, `EosSarifDiagnosticPatchSynthesizerCore`, `EosFleetMultiRepoShipOrchestratorCore`) reside strictly in Layer-0 (`src/core/`) importing only `node:*` (`node:fs`, `node:path`) and `./eosKernelPrimitives.ts`. Dispatch surfaces remain cleanly separated in CLI (`bin/commands/cliJarvisPolyglotFrontierMesh.mjs`) and MCP (`src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts`).

---

## 2. Architectural Decision Records (ADRs)

### ADR-122-001 — Isolated Temp Seal Verification & Bounded Retry Writes

- **Decision**: Add `writeFileWithRetry` + `--out=<path>` to `scripts/tip-refresh.mjs` so `test/eosReleaseDocConsistency.test.mjs` verifies `--seal-pin` against an isolated `os.tmpdir()` output rather than overwriting `docs/releases/EOS_FREEZE_GATE_STATUS.md` in place.
- **Rejected Alternative**: Serializing all `node --test` suites globally (`--test-concurrency=1`), which forfeits multi-core CI speedup and leaves other lock-sensitive tooling vulnerable.

### ADR-122-002 — Zero-Dependency Regex/Structural Extractor For Contract Semantic Diff

- **Decision**: Extract exported functions (with required vs optional/defaulted parameter arity), interfaces, classes, types, and consts deterministically without spawning the full `typescript` compiler API inside Layer-0.
- **Rejected Alternative**: Importing `typescript` compiler AST inside `src/core/`, which violates `dependencies: {}` and Law V boundary rules.

### ADR-122-003 — Standards-Compliant OASIS SARIF 2.1.0 Envelope + Law IV Fleet Gate

- **Decision**: Emit native SARIF 2.1.0 schema JSON alongside unified diff patch hunks and evaluate all 6 Law IV preconditions across `docs/projects/registry.json` inside bounded Layer-0 modules.
- **Rejected Alternative**: Emitting proprietary report schemas or mutating external sibling repositories without Law IV precondition checks.
