# PLAN-124 — Architecture Plan & ADRs (`CHANGE-124` / `SPEC-247`..`SPEC-249`)

## Metadata

- **Plan ID**: PLAN-124
- **Change Ref**: CHANGE-124
- **Target SPECs**: SPEC-247, SPEC-248, SPEC-249
- **Date**: 2026-11-13
- **Status**: APPROVED

---

## 1. Architecture Boundaries (Law V Compliance)

Modules 62–64 reside strictly inside `src/core/` using only `node:*` built-ins (`node:crypto`, `node:fs`, `node:path`) and sibling `./*.ts` core modules (`eosKernelPrimitives.ts`, `eosInTotoSlsaEd25519AttestorCore.ts`). No third-party runtime dependencies are introduced.

---

## 2. Architectural Decision Records (ADRs)

### ADR-124-001 — Unified LEC + STA + seL4 Non-Interference Prover

- **Decision**: Combine bounded/exhaustive observational equivalence checking (`referenceFn(x) === candidateFn(x)`), Kahn topological longest-path STA with cycle rejection, and static downward-flow security-domain lattice enforcement inside `EosEdaEquivalenceTimingProverCore`.
- **Rejected Alternative**: Invoking external heavyweight SAT/SMT binaries not bundled with Node.js.

### ADR-124-002 — Self-Contained Offline Air-Gapped Release Bundles

- **Decision**: Compute sorted SHA-256 binary Merkle trees over bundle artifacts, embed Ed25519 DSSE attestations from `EosInTotoSlsaEd25519AttestorCore`, verify offline without network I/O, and enforce recall + node hardware constraints in `EosApolloAirGappedBundleOrchestratorCore`.
- **Rejected Alternative**: Online registry polling during deployment verification, which fails inside SCIF/air-gapped targets.

### ADR-124-003 — Seeded Deterministic Monte Carlo VaR/CVaR Fleet Stress & Docs Beyoncé Fix

- **Decision**: Model independent node shocks and correlated cascade contagion via deterministic `xorshift32` in `EosAladdinSystemicRiskStressCore`, and refine `EosIssueToPrCanaryBridgeCore.classifyFileLayer` to exempt pure `Documentation` changes (`docs/`, `openspec/`, `*.md`) from production-code Beyoncé blocks.
- **Rejected Alternative**: Non-deterministic `Math.random()` simulations or treating freeze-gate Markdown seals as un-tested production code.
