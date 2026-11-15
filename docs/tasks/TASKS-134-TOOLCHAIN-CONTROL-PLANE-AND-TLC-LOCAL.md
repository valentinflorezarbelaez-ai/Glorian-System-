# TASKS-134 — Implementation Checklist (`CHANGE-134` / `SPEC-272`)

- [ ] `T-01`: Author `INTAKE-134`, `CHANGE-134`, `SPEC-272`, `PLAN-134`, `TASKS-134`, and record `AUTH-2026-11-14-TOOLCHAIN-CONTROL-PLANE-AND-TLC-LOCAL` (`LEVEL 3`).
- [ ] `T-02`: Enhance `src/core/eosEventLoopSaturationGovernor.ts` and `api/_shield.js` with warmup grace cycle counter to eliminate cold-start false shedding.
- [ ] `T-03`: Implement `src/core/eosToolchainDoctor.ts` with secure binary probing across the 13 supported tools (`docker`, `kubectl`, `kind`, `helm`, `trivy`, `opa`, `terraform`, `k6`, `java`, `rustc`, `cargo`, `go`, `python`) and SHA-256 receipt generation.
- [ ] `T-04`: Bind `eos toolchain:doctor` in CLI dispatch (`bin/commands/cliPlatform.mjs` / `cliDevOps.mjs`).
- [ ] `T-05`: Download and cryptographically verify `tools/tla2tools.jar` against canonical release SHA-256 (`7e53aa636dac8a3cb0533f343115c0548e03fc0ce5edc7739becf58d3d0fb84f`).
- [ ] `T-06`: Run `node scripts/run-tlc.mjs` to execute TLC formal model exploration locally in mode `LIVE_LOCAL_TLC`.
- [ ] `T-07`: Author comprehensive test suite `test/eosToolchainControlPlaneAndTlcLocal.test.mjs` verifying `BDD-1407`..`BDD-1412`.
- [ ] `T-08`: Run full CI validation pipeline (`node scripts/verify-cicd-pipeline.mjs`), refresh freeze gate, and verify clean passing state.
