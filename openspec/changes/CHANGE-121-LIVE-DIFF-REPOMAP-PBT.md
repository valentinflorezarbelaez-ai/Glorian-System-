# CHANGE-121 — Live Git Diff PR Inspector, RepoMap Compressor, Shrinking PBT & `glorian ship`

## Metadata

- **Change ID**: CHANGE-121
- **Target SPECs**: SPEC-238, SPEC-239, SPEC-240
- **Intake Ref**: INTAKE-121
- **Date**: 2026-11-13
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Implement Modules 53, 54, and 55 in pure Layer-0 TypeScript plus the unified `ship` command and MCP workflow:

- **Module 53 (`SPEC-238`) — `EosLiveGitDiffPrInspectorCore`**: Reads live Git diff (`numstat` + added lines) or explicit overrides cleanly confined to `projectRoot`, flags credentials/unsafe SQL/missing tests, composes `EosIssueToPrCanaryBridgeCore`, and writes `.eos/pr-ready-bundle.md` on request.
- **Module 54 (`SPEC-239`) — `EosRepoMapSymbolCompressorCore`**: Extracts public symbols and relative imports across TS/JS/Go/Python/Java/Rust files within `projectRoot`, ranks files by centrality, packs signatures strictly within `maxTokenBudget`, and reports `tokenSavingsPercent`.
- **Module 55 (`SPEC-240`) — `EosPropertyBasedShrinkingFuzzerCore`**: Provides deterministic `xorshift32`-seeded numeric and string property checks with binary counterexample shrinking to minimal failing inputs.
- **Unified Master Orchestration**: Wires `diff:live`, `repomap:build`, `pbt:check`, `ship`, and MCP actions (`live_diff_inspect`, `repomap_compress`, `pbt_shrink_check`, `jarvis_ship_readiness`).
