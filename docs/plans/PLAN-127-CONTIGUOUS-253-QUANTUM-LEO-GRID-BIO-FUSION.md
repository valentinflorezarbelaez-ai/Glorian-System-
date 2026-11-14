# PLAN-127 — Architecture Plan & ADRs (`CHANGE-127` / `SPEC-101`..`SPEC-105`)

## Metadata

- **Plan ID**: PLAN-127
- **Change Ref**: CHANGE-127
- **Target SPECs**: SPEC-101, SPEC-102, SPEC-103, SPEC-104, SPEC-105
- **Date**: 2026-11-14
- **Status**: APPROVED

---

## 1. Architecture Boundaries (Law V Compliance)

Modules 69 (`EosSurfaceCodeQuantumErrorCorrectionCore`), 70 (`EosLeoConstellationOpticalRoutingCore`), 71 (`EosPowerGridOptimalPowerFlowCore`), 72 (`EosBioSequenceFoldingConfidenceCore`), and 73 (`EosInertialFusionLawsonIgnitionCore`) reside strictly in Layer-0 `src/core/`, importing only `./eosKernelPrimitives.ts` (`deepFreeze`, `pureSha256`, `assertPrecondition`) and their paired `.types.ts` contracts.

---

## 2. Architectural Decision Records (ADRs)

### ADR-127-001 — Closing Historical Gaps (`SPEC-101`..`SPEC-105`) for `253/253` Contiguous OpenSpec Integrity

- **Decision**: Assign Modules 69–73 to the five remaining unassigned identifiers `SPEC-101`..`SPEC-105`, reaching `253/253` contiguous specifications (`SPEC-001`..`SPEC-253`) verified by `scripts/verify-reference-integrity.mjs`.
- **Rejected Alternative**: Allocating five new identifiers above `253`, which would preserve an artificial five-spec numbering gap.

### ADR-127-002 — Top-7 Preventive Structural Decompression (`<= 767` Lines, `minHeadroomLines >= 33`)

- **Decision**: Extract private utility helpers and type interfaces cleanly in `eosEnterpriseWorkspaceGovernor.ts`, `eosMerklePatriciaTrieCore.ts`, `eosRaftConsensusEngine.ts`, `eosTypeScriptAstAnalyzer.ts`, `eosMcpServer.ts`, `cliFrontierMesh.mjs`, and `eosUniversalProjectAdapter.ts` using explicit `export type { ... }` preservation so `contract:live` guarantees `0` breaking symbol changes.
- **Rejected Alternative**: Leaving `780–782` line modules near the `800`-line hard limit with only `18–20` lines of headroom.

### ADR-127-003 — Extended `eos_enterprise_workspace` Action Validation Without Inflating `tools/list` LLM Schemas

- **Decision**: Update `EosMcpSchemaValidator.validateToolCallArguments` in `src/core/eosMcpSchemaValidator.ts` to accept well-formed snake_case extended actions (`^[a-z][a-z0-9_]{1,63}$`) for `eos_enterprise_workspace` while retaining the compact Tier-0 enum surface in `eosMcpToolDefinitionsPart04.ts` and `docs/contracts/mcp-tool-catalog.json`.
- **Rejected Alternative**: Enumerating 50+ facade actions directly inside `eosMcpToolDefinitionsPart04.ts`, which bloats prompt schema tokens on every `tools/list` roundtrip and churns `mcp-tool-catalog.json`.
