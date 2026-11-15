# TASKS-132 — Implementation Checklist (`CHANGE-132` / `SPEC-270`)

- [x] `T-01`: Author `INTAKE-132`, `CHANGE-132`, `SPEC-270`, `PLAN-132`, `TASKS-132`, and record `AUTH-2026-11-14-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET` (`LEVEL 3`).
- [x] `T-02`: Create `.cfg` model configuration files in `docs/formal/` for `LmaxDisruptor`, `HermesConsensusMesh`, `DatomicBitemporalLedger`, and `AutonomousChaosDisruptor`.
- [x] `T-03`: Update `HermesConsensusMesh.tla` (add `FiniteSets` to `EXTENDS`), `DatomicBitemporalLedger.tla` (add `TLC` to `EXTENDS`), and `AutonomousChaosDisruptor.tla` (add `Next` and `Spec`).
- [x] `T-04`: Author `scripts/run-tlc.mjs` with runtime detection, model checking execution, distinct state parsing, evidence receipt emission (`docs/evidence/TLC_RECEIPT.json`), and negative calibration testing.
- [x] `T-05`: Wire TLC formal model checking step into `.github/workflows/eos-nightly-deep-gates.yml` using `actions/setup-java@3a4f6e1af504cf6a31855fa899c6aa5355ba6c12` and pinned `tla2tools.jar`.
- [x] `T-06`: Update `scripts/mutation-gate.mjs` with `CUSTOM_TARGET_TEST_MAP` and expand `DEFAULT_TARGETS` with governance targets.
- [x] `T-07`: Update `docs/quality/mutation-budget.json` with new targets and ratcheted score floors.
- [x] `T-08`: Author `scripts/verify-module-consumers.mjs` to map internal dependencies and enforce consumer coverage.
- [x] `T-09`: Author comprehensive tests in `test/eosTlcAndMutationRatchetElevation.test.mjs` covering `BDD-1396`..`BDD-1400`.
- [x] `T-10`: Run full CI test suite, verify all gates (`npm run test:ci`), format codebase, update catalog/freeze gates, commit, and push.
