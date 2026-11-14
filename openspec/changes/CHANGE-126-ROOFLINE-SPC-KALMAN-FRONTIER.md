# CHANGE-126 — Roofline Planner, Six-Sigma SPC Yield, Kalman Quad-Voter & Full Structural Parity (`SPEC-251`..`SPEC-253`)

## Metadata

- **Change ID**: CHANGE-126
- **Target SPECs**: SPEC-251, SPEC-252, SPEC-253
- **Intake Ref**: INTAKE-126
- **Date**: 2026-11-14
- **Status**: APPROVED
- **Layer**: Layer-0 (Zero external runtime dependencies)

---

## 1. Description

Implement Modules 66–68 (`SPEC-251`..`SPEC-253`), decompress the top 6 largest repository modules to raise structural headroom to `>= 18` lines (`<= 782` lines per file), and achieve 100% (`342/342`) command documentation parity in `docs/DEVELOPER_GUIDE.md`:

- **Module 66 (`SPEC-251`) — `EosComputeGraphRooflinePlannerCore`**: Layer-0 Roofline analyzer, operator fusion engine, and 64-byte aligned static arena allocator (`src/core/eosComputeGraphRooflinePlannerCore.types.ts` & `.ts`).
- **Module 67 (`SPEC-252`) — `EosStatisticalProcessYieldControlCore`**: Layer-0 Six-Sigma SPC evaluator (`Shewhart`, `Cp`/`Cpk`, two-sided `CUSUM`, `EWMA`, `Poisson`/`Murphy` yield) (`src/core/eosStatisticalProcessYieldControlCore.types.ts` & `.ts`).
- **Module 68 (`SPEC-253`) — `EosKalmanStateEstimatorAndQuadVoterCore`**: Layer-0 2-state kinematic Kalman estimator coupled with 4-channel Quad-Modular Redundancy median fault isolation (`src/core/eosKalmanStateEstimatorAndQuadVoterCore.types.ts` & `.ts`).
- **Structural Decompression**: Extract `.types.ts` files for `eosGentlemanAutoUpdater.ts` and `eosKnowledgeGraphEngine.ts`, extract shared helpers in `cliFrontierMesh.mjs`, `verify-cicd-pipeline.mjs`, and `tlaSimulationsPart2.mjs`, and compact literal templates in `eosSpotifyCodex.ts`.
- **Ergonomic Exposure & Full Documentation Parity**: Export Modules 66–68 in `src/core/index.ts` and `package.json`, wire `roofline:plan`, `spc:audit`, `kalman:estimate`, enrich `ship`, wire MCP actions under `eos_enterprise_workspace`, synchronize `cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (`342/342` commands), and verify `BDD-1276`..`BDD-1290`.
