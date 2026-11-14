# TASKS-127 — Implementation Checklist (`CHANGE-127` / `SPEC-101`..`SPEC-105`)

- [x] `T-01`: Author `INTAKE-127`, `CHANGE-127`, `SPEC-101`..`SPEC-105`, `PLAN-127`, `TASKS-127`, and record `AUTH-2026-11-14-CONTIGUOUS-253-QUANTUM-LEO-GRID-BIO-FUSION` (`LEVEL 3`).
- [x] `T-02`: Decompress the Top 7 largest modules (`eosEnterpriseWorkspaceGovernor.ts`, `eosMerklePatriciaTrieCore.ts`, `eosRaftConsensusEngine.ts`, `eosTypeScriptAstAnalyzer.ts`, `eosMcpServer.ts`, `cliFrontierMesh.mjs`, `eosUniversalProjectAdapter.ts`) to `<= 767` lines (`minHeadroomLines >= 33`) with zero `contract:live` breaking changes.
- [x] `T-03`: Unify `EosMcpSchemaValidator.validateToolCallArguments` for valid extended snake_case `eos_enterprise_workspace` actions without inflating `tools/list`.
- [x] `T-04`: Implement Module 69 (`SPEC-101` — Surface Code Quantum Error Correction) in `src/core/eosSurfaceCodeQuantumErrorCorrectionCore{.types,}.ts`.
- [x] `T-05`: Implement Module 70 (`SPEC-102` — LEO Constellation Optical ISL & QKD Routing) in `src/core/eosLeoConstellationOpticalRoutingCore{.types,}.ts`.
- [x] `T-06`: Implement Module 71 (`SPEC-103` — State Grid DC-OPF & Frequency Stability) in `src/core/eosPowerGridOptimalPowerFlowCore{.types,}.ts`.
- [x] `T-07`: Implement Module 72 (`SPEC-104` — AlphaFold Bio-Sequence Alignment & Folding Confidence) in `src/core/eosBioSequenceFoldingConfidenceCore{.types,}.ts`.
- [x] `T-08`: Implement Module 73 (`SPEC-105` — Exascale Inertial Fusion Lawson Ignition) in `src/core/eosInertialFusionLawsonIgnitionCore{.types,}.ts`.
- [x] `T-09`: Wire Modules 69–73 into `src/core/index.ts`, `package.json`, CLI (`qec:decode`, `leo:route`, `grid:opf`, `bio:fold`, `fusion:ignite`, enriched `ship`), MCP dispatcher, `cliHelpCatalog.mjs` (`347/347`), and `docs/DEVELOPER_GUIDE.md` (`347/347`).
- [x] `T-10`: Author `test/eosContiguous253FrontierEngines.test.mjs` (`BDD-1291`..`BDD-1315`) + step `#54` in `test/eosEnterpriseFacade.test.mjs`, verify full gates (`253/253` contiguous specs, `347/347` CLI parity, `minHeadroomLines >= 33`, `0` failures), commit, seal Freeze Gate, and push to `origin/main`.
