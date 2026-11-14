# PLAN-126 — Architecture Plan & ADRs (`CHANGE-126` / `SPEC-251`..`SPEC-253`)

## Metadata

- **Plan ID**: PLAN-126
- **Change Ref**: CHANGE-126
- **Target SPECs**: SPEC-251, SPEC-252, SPEC-253
- **Date**: 2026-11-14
- **Status**: APPROVED

---

## 1. Architecture Boundaries (Law V Compliance)

Modules 66 (`EosComputeGraphRooflinePlannerCore`), 67 (`EosStatisticalProcessYieldControlCore`), and 68 (`EosKalmanStateEstimatorAndQuadVoterCore`) live strictly in `src/core/` with pure type definitions in paired `.types.ts` files, importing only `./eosKernelPrimitives.ts` (`deepFreeze`, `pureSha256`).

---

## 2. Architectural Decision Records (ADRs)

### ADR-126-001 — Pure Deterministic Linear Algebra & Graph Solvers Without External Numerics Libraries

- **Decision**: Implement Roofline topology + aligned arena offset allocation, tabular CUSUM / EWMA / Shewhart / Murphy yield math, and $2\times 2$ Kalman predict/update + 4-channel median voting in pure TypeScript under Layer-0 (`src/core/`).
- **Rejected Alternative**: Pulling external BLAS/numpy/scipy/WASM runtime packages, which violates Constitutional Law V zero-dependency isolation.

### ADR-126-002 — Preventive Module Decompression Target (`<= 782` Lines Across All Modules)

- **Decision**: Decompress the 6 largest modules (`cliFrontierMesh.mjs`, `verify-cicd-pipeline.mjs`, `eosGentlemanAutoUpdater.ts`, `tlaSimulationsPart2.mjs`, `eosKnowledgeGraphEngine.ts`, and `eosSpotifyCodex.ts`) using `.types.ts` extractions and shared helper functions to achieve `minHeadroomLines >= 18` while preserving public contracts verified by `contract:live`.
- **Rejected Alternative**: Leaving modules at `783–787` lines where minor future fixes risk colliding with the `800`-line hard limit.

### ADR-126-003 — Full `342/342` Documentation Parity in `docs/DEVELOPER_GUIDE.md`

- **Decision**: Document Modules 66–68 and append a domain-grouped exhaustive CLI command & alias reference index (`### 4.1`) in `docs/DEVELOPER_GUIDE.md` so `EosCliCatalogAndHygieneGovernorCore` reports `developerGuideDocumentedCount === totalCommandsRegistered` (`342/342`).
- **Rejected Alternative**: Duplicating `cliHelpCatalog.mjs` verbatim or leaving over half of the registered CLI surface undocumented in written engineering docs.
