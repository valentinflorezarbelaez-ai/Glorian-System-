# CHANGE-122 — API Contract Semantic Diff, SARIF 2.1.0 Patcher, Fleet Multi-Repo Ship & Concurrency Hardening

## Metadata

- **Change ID**: CHANGE-122
- **Target SPECs**: SPEC-241, SPEC-242, SPEC-243
- **Intake Ref**: INTAKE-122
- **Date**: 2026-11-13
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Implement Windows parallel test lock hardening, telemetry p95 sanitization, and Modules 56–58 in pure Layer-0 TypeScript:

- **Hardening**: Add atomic write retry + isolated `--out=<tmp>` sealing in `scripts/tip-refresh.mjs` and `test/eosReleaseDocConsistency.test.mjs`, plus bounded sample filtering and active-suite scoping in `EosPerformanceRegressionTracker` & `scripts/quality-gates.mjs`.
- **Module 56 (`SPEC-241`) — `EosApiContractSemanticDiffCore`**: Compares baseline vs candidate TypeScript/interface exports to flag `REMOVED_PUBLIC_SYMBOL`, `ARITY_INCREASED_BREAKING`, `REMOVED_REQUIRED_FIELD`, and `ADDITIVE_NON_BREAKING`, emitting required semver bump (`MAJOR`/`MINOR`/`PATCH`) and Expand-and-Contract remediation guidance.
- **Module 57 (`SPEC-242`) — `EosSarifDiagnosticPatchSynthesizerCore`**: Generates OASIS SARIF 2.1.0 JSON documents with deduplicated rules, `physicalLocation` coordinates, `fixes` suggestions, unified diff remediation hunks, and path-confined `.eos/glorian-ship.sarif.json` persistence.
- **Module 58 (`SPEC-243`) — `EosFleetMultiRepoShipOrchestratorCore`**: Reads `docs/projects/registry.json` (or explicit project overrides) inside `projectRoot`, verifies all 6 EOS Law IV preconditions per project, calculates readiness scores, and emits `FLEET_SHIP_READY` or `FLEET_PARTIAL_BLOCK` digests.
- **Unified Orchestration**: Wires `contract:diff`, `sarif:export`, `fleet:ship`, extends `ship`, exposes MCP actions `api_contract_diff`, `sarif_patch_synthesize`, `fleet_ship_orchestrate`, and subpath exports `./contract-diff`, `./sarif`, `./fleet-ship`.
