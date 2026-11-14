# INTAKE-127 — Contiguous 253/253 OpenSpec Closure (`SPEC-101`..`SPEC-105`), Top-7 Module Decompression (`<= 767` Lines), MCP Extended Action Validation, & `347/347` CLI Parity

## Metadata

- **Intake ID**: INTAKE-127
- **Change Ref**: CHANGE-127
- **Target SPECs**: SPEC-101, SPEC-102, SPEC-103, SPEC-104, SPEC-105
- **Date**: 2026-11-14
- **Requester**: Valentín Flórez Arbeláez (System Owner — directive `"todo junto si dale"`)
- **Status**: INTAKE_COMPLETE

---

## 1. Context & Problem Statement

Following `SPEC-251`..`SPEC-253` (`CHANGE-126`), a repository-wide telemetry and coverage audit identified four high-impact structural and functional upgrades:

1. **Close the 5-Spec Historical Sequence Gap (`SPEC-101`..`SPEC-105` -> `253/253` Contiguous)**: Fill the 5 unassigned identifiers `SPEC-101`..`SPEC-105` with Layer-0 engines covering global frontier domains missing from `src/core/`:
   - `SPEC-101`: Surface Code Quantum Error Correction (`EosSurfaceCodeQuantumErrorCorrectionCore` — Google Quantum AI Willow / IBM Heron).
   - `SPEC-102`: LEO Constellation Optical ISL & QKD Routing (`EosLeoConstellationOpticalRoutingCore` — SpaceX Starlink / CASC Quantum-LEO).
   - `SPEC-103`: DC Optimal Power Flow & Grid Frequency Stability (`EosPowerGridOptimalPowerFlowCore` — State Grid UHV / DOE Oak Ridge).
   - `SPEC-104`: Bio-Sequence Alignment & Folding Confidence (`EosBioSequenceFoldingConfidenceCore` — DeepMind AlphaFold / Isomorphic Labs).
   - `SPEC-105`: Inertial Confinement Fusion Lawson Ignition (`EosInertialFusionLawsonIgnitionCore` — LLNL El Capitan / ORNL Frontier).
2. **Decompress the Top-7 Largest Modules (`774–782` lines -> `<= 767` lines, `minHeadroomLines >= 33`)**: Extract helper/type definitions cleanly in `eosEnterpriseWorkspaceGovernor.ts`, `eosMerklePatriciaTrieCore.ts`, `eosRaftConsensusEngine.ts`, `eosTypeScriptAstAnalyzer.ts`, `eosMcpServer.ts`, `cliFrontierMesh.mjs`, and `eosUniversalProjectAdapter.ts` with zero SemVer breaking changes.
3. **Unify JSON-RPC `tools/call` Validation for Extended `eos_enterprise_workspace` Actions**: Allow valid snake_case extended actions on `eos_enterprise_workspace` during `tools/call` validation without altering `tools/list` tool schemas or inflating LLM context tokens.
4. **Full `347/347` CLI & Developer Guide Parity**: Expose `qec:decode`, `leo:route`, `grid:opf`, `bio:fold`, and `fusion:ignite` across CLI, MCP, `cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`, and `eos ship`.

---

## 2. Constraints

- **Zero Runtime Dependencies (Law V)**: All new Layer-0 engines under `src/core/` import strictly `node:*` built-ins and sibling `./*.ts` modules.
- **Complexity & Headroom Budget**: Cyclomatic complexity `<= 15` per function; every `.ts`/`.mjs` module under `<= 767` lines (`minHeadroomLines >= 33`).
- **Contract & Tier-0 Preservation**: `contract:live --json` must report `totalBreakingChanges: 0` and `backwardCompatible: true`; Tier-0 MCP tool count stays `46`.
