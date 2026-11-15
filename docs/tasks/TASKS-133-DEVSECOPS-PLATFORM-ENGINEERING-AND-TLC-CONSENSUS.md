# TASKS-133 — Implementation Checklist (`CHANGE-133` / `SPEC-271`)

- [x] `T-01`: Author `INTAKE-133`, `CHANGE-133`, `SPEC-271`, `PLAN-133`, `TASKS-133`, and record `AUTH-2026-11-14-DEVSECOPS-PLATFORM-ENGINEERING-AND-TLC-CONSENSUS` (`LEVEL 3`).
- [x] `T-02`: Integrate `EosAdaptiveRateLimiter`, `EosEventLoopSaturationGovernor`, and `EosIdempotencyKeyStore` into `api/kernel.js` and `api/health.js`.
- [x] `T-03`: Integrate `EosCycloneDxSbomGenerator` into `scripts/sbom-gate.mjs` to generate `docs/evidence/cyclonedx-sbom.json` (CycloneDX v1.5).
- [x] `T-04`: Create `docs/formal/BftAgentSwarmSlashing.cfg` and `docs/formal/CellBasedBulkheadGovernor.cfg`, ensuring TLA+ modules are compatible with TLC parser.
- [x] `T-05`: Update `scripts/run-tlc.mjs` to include `BftAgentSwarmSlashing` and `CellBasedBulkheadGovernor` in `CONFIGURED_SPECS`.
- [x] `T-06`: Author `scripts/coverage-ratchet.mjs` and create `docs/quality/coverage-budget.json` (PTS-driven incremental coverage).
- [x] `T-07`: Wire incremental coverage ratchet into `scripts/verify-cicd-pipeline.mjs` Stage 4.5.
- [x] `T-08`: Author comprehensive test suite `test/eosDevSecOpsAndTlcConsensusElevation.test.mjs` (`BDD-1401`..`BDD-1406`).
- [x] `T-09`: Re-run `scripts/verify-module-consumers.mjs` to confirm reduction of unconsumed leaf modules and higher graph density.
- [x] `T-10`: Run full CI validation (`npm run test:ci`), format codebase, update catalog and freeze gate to `SPEC-271`, commit, and push.
