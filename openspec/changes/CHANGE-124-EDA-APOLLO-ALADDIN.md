# CHANGE-124 — EDA Formal Prover, Apollo Air-Gapped Bundle & Aladdin Systemic Stress (`SPEC-247`..`SPEC-249`)

## Metadata

- **Change ID**: CHANGE-124
- **Target SPECs**: SPEC-247, SPEC-248, SPEC-249
- **Intake Ref**: INTAKE-124
- **Date**: 2026-11-13
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Implement Modules 62, 63, and 64 in pure Layer-0 TypeScript plus documentation-only Beyoncé Rule classification refinement, CLI, MCP, SDD, and BDD coverage:

- **Module 62 (`SPEC-247`) — `EosEdaEquivalenceTimingProverCore`**: Proves bounded/exhaustive Logical Equivalence (`LEC`) with exact counterexample extraction, evaluates DAG Critical Path & Timing Slack (`STA`) with cycle detection, and enforces `seL4`-style `HIGH_SECRET` -> `LOW_PUBLIC` information-flow non-interference.
- **Module 63 (`SPEC-248`) — `EosApolloAirGappedBundleOrchestratorCore`**: Compiles and verifies 100% offline Sovereign Air-Gapped Release Bundles using deterministic SHA-256 Merkle roots, Ed25519 DSSE signatures, recall checks, tactical node constraint enforcement, and path-confined persistence.
- **Module 64 (`SPEC-249`) — `EosAladdinSystemicRiskStressCore`**: Executes deterministic `xorshift32` Monte Carlo systemic stress simulations over the registered fleet, measuring `expectedAvailabilityPercent`, `valueAtRisk95Percent`, `valueAtRisk99Percent`, `expectedShortfall99Percent`, `contagionAmplificationFactor`, and risk tiers (`RESILIENT_AAA`, `GUARDED_AA`, `SYSTEMIC_CRITICAL`).
- **Docs-Only Beyoncé Rule Refinement**: Classifies `docs/**`, `openspec/**`, and `*.md` paths as `"Documentation"` in `EosIssueToPrCanaryBridgeCore` so pure documentation or freeze-gate commits pass without requiring fake test changes.
- **Unified Orchestration**: Wires `eda:prove`, `apollo:bundle`, `aladdin:stress`, enriches `ship`, exposes MCP actions `eda_equivalence_timing_prove`, `apollo_airgap_bundle`, `aladdin_systemic_stress`, and subpath exports `./eda-prover`, `./apollo-airgap`, `./aladdin-stress`.
