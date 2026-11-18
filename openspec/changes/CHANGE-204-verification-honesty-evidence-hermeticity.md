# CHANGE-204: Verification Honesty, Evidence Hermeticity & Measured Telemetry (`SPEC-342`)

- **Change ID**: `CHANGE-204`
- **Spec**: `SPEC-342`
- **Authorization Level**: `LEVEL_3_PRODUCTION_AUTHORIZED`

## Summary of Changes

1. **Verification Honesty in TLC & SMT (`SPEC-342 FR-1..5`)**:
   - Replaced fail-open simulation stubs with truthful reporting in `src/core/eosZ3WasmProver.ts`. When Java or `tla2tools.jar` is missing, `EosTlcModelChecker.runTlc` reports `status: "NOT_VERIFIED"`, `verified: false`, with zero fabricated state counters.
   - Live TLC runs use isolated temporary `-metadir` to guarantee zero repository metadata pollution.
   - Introduced `EosIntervalConstraintSolver`, sound and complete for single-variable integer bound constraints and boolean equalities over unbounded domains. Deprecated `EosZ3SmtSolver` alias and eliminated ungrounded Z3 branding claims.
   - `proveInductiveInvariant` now requires domains to be transition-closed for `INDUCTIVE_INVARIANT_PROVEN`, reporting `HOLDS_ON_SAMPLED_DOMAIN` on open domains.
   - `auditFormalProver` distinguishes `totalTlaSpecsInventoried` from `totalTlaSpecsChecked`, with deterministic SHA-256 signatures excluding volatile timestamps.

2. **Fleet Boundary Probing & Offline Honesty (`SPEC-342 FR-6..7`)**:
   - Refactored `EosMetamorphicDifferentialBlindSpotCore.auditFleetProjects`: without live probe transport, it honestly returns `mode: "OFFLINE_NOT_VERIFIED"` and `allPassed: false`, prohibiting synthetic in-memory stubs.
   - When given probe transport, it classifies endpoints into `VERIFIED`, `FINDINGS`, and `UNREACHABLE`.

3. **Causal Evidence with Provenance (`SPEC-342 FR-8`)**:
   - Extended `EosClosedLoopRepoAutopilotCore` to attach explicit `evidenceProvenance` (`MEASURED` vs `PRIOR`), measuring mutation score baseline averages from `mutation-budget.json`.

4. **Hermetic Evidence Directory Resolver (`SPEC-342 FR-9`)**:
   - Created `src/core/eosEvidencePaths.ts` with `resolveEvidenceDir()` and `resolveEvidencePath()`, honoring `EOS_EVIDENCE_DIR` so test runners and audits can run without dirtying tracked files in `docs/evidence/`.

5. **Dedicated Performance Benchmark Lane (`SPEC-342 FR-10`)**:
   - Authored `scripts/bench.mjs` (`npm run bench`) for isolated, non-flaky micro-benchmarks (HNSW k-NN, ZeroCopyRingBuffer, Interval Constraint Solver).
