# INTAKE-126 — NVIDIA Compute Roofline Planner, TSMC/ASML Six-Sigma SPC Yield Control, SpaceX Kalman GNC Quad-Voter, & Full Structural/Documentation Parity

## Metadata

- **Intake ID**: INTAKE-126
- **Change Ref**: CHANGE-126
- **Target SPECs**: SPEC-251, SPEC-252, SPEC-253
- **Date**: 2026-11-14
- **Requester**: Valentín Flórez Arbeláez (System Owner — directive `"todo junto"`)
- **Status**: INTAKE_COMPLETE

---

## 1. Context & Problem Statement

Following the completion of `SPEC-250` (`CHANGE-125`), an architectural review anchored in Big Tech, semiconductor foundry, and aerospace engineering benchmarks identified three frontier Layer-0 capabilities and two structural hygiene elevations to unlock in a single cohesive wave:

1. **Compute Graph Roofline & Static Arena Planner (`SPEC-251` — NVIDIA TensorRT / DeepMind XLA)**: Layer-0 planner calculating arithmetic intensity ($\text{FLOPs/Byte}$), hardware ridge point, compute-bound vs. memory-bound regime classification, deterministic operator fusion (`MATMUL -> BIAS_ADD -> RELU`), and 64-byte aligned zero-fragmentation static memory arena layout.
2. **Six-Sigma SPC & Yield Control Engine (`SPEC-252` — TSMC / ASML Foundry SPC)**: Layer-0 statistical process control engine implementing Shewhart limits (`UCL`/`LCL`), process capability ($C_p$, $C_{pk}$), two-sided tabular CUSUM & EWMA drift detection, and Poisson / Murphy semiconductor yield models to detect regressions early across CI/CD and SLO telemetry.
3. **Kalman Kinematic Estimator & Quad-Modular Redundant Voter (`SPEC-253` — SpaceX Starship GNC / NASA JPL)**: Layer-0 2-state linear kinematic Kalman filter paired with a 4-channel QMR median fault-isolation voter to reject Byzantine or degraded telemetry channels while tracking covariance convergence (`covarianceTrace`, `NIS`).
4. **Preventive Structural Decompression (`minHeadroomLines >= 18`)**: Proactively decompress the 6 largest modules (`782–787` lines): `bin/commands/cliFrontierMesh.mjs`, `scripts/verify-cicd-pipeline.mjs`, `src/core/eosGentlemanAutoUpdater.ts`, `scripts/tla/tlaSimulationsPart2.mjs`, `src/core/eosKnowledgeGraphEngine.ts`, and `src/core/eosSpotifyCodex.ts`.
5. **100% Documentation Command Parity (`342/342`)**: Elevate `docs/DEVELOPER_GUIDE.md` from partial CLI table coverage (`153` commands) to full `342/342` (`100%`) command and alias parity synchronized with `bin/commands/cliHelpCatalog.mjs`.

---

## 2. Constraints

- **Zero Runtime Dependencies (Law V)**: All Layer-0 engines under `src/core/` import strictly `node:*` built-ins and sibling `./*.ts` modules.
- **Complexity & Headroom Budget**: Cyclomatic complexity `<= 15` per function; every `.ts`/`.mjs` file under `src/`, `bin/`, `scripts/` must remain `<= 782` lines (`minHeadroomLines >= 18`).
- **Tier-0 MCP Budget & Backward Compatibility**: Expose `roofline_compute_plan`, `spc_yield_audit`, and `kalman_quad_vote` under `eos_enterprise_workspace` (`46` Tier-0 tools unchanged), preserve `SPEC-065` `eos help` headings, and pass `contract:live --json` with zero breaking symbol changes.
