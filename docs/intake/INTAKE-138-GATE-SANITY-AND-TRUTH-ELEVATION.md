# INTAKE-138: Gate Sanity, SARIF Truth & Strict CI Unification

## 1. Context & Business Intent
- **System**: Glorian System (EOS Control Plane Core).
- **Driver**: Transition from declarative local simulation gates to industrial-grade fail-closed Big Tech verification gates (Google, Palantir, Anduril standard).
- **Core Principle**: "A check that cannot break the build is documentation, not engineering."
- **Identified Deficiencies**:
  1. SARIF currently hardcodes `results: []` and only writes when nothing throws; exits before write if an assertion fails.
  2. Dual SARIF writers (`verify-cicd-pipeline.mjs` and `eos-github-pr-attestation.mjs`) collide on `docs/evidence/local-checks.sarif`.
  3. Secret scanning in `eos-github-pr-attestation.mjs` was constrained to 4 candidate files with 3 regexes instead of full repo scanning.
  4. OpenSpec compliance in `eos-github-pr-attestation.mjs` counted matches but never asserted `compliantSpecs === specFiles.length`.
  5. GitHub Actions workflows were split across 3 overlapping files (`eos-gate.yml`, `eos-strict-gate.yml`, `eos-sovereign-cicd.yml`) with divergent Node versions and unpinned actions.
  6. Sequential test execution (146 processes spawned individually) created unnecessary latency.

## 2. Scope of Work (Horizon 1)
- Refactor `scripts/verify-cicd-pipeline.mjs` to accumulate diagnostic findings across all 7 stages into a structured findings collection.
- Enclose the execution in a `try ... finally` block so that `docs/evidence/local-checks.sarif` is guaranteed to be written with real findings on both success and failure.
- Ensure the script exits with non-zero exit code if any findings are present.
- Connect `scripts/eos-secret-scan.mjs` (which scans all 970+ files) into `scripts/eos-github-pr-attestation.mjs`.
- Enforce strict `assert.equal(compliantSpecs, specFiles.length)` in `scripts/eos-github-pr-attestation.mjs`.
- Consolidate GitHub Actions workflows into a unified, hardened sovereign CI pipeline (`.github/workflows/eos-sovereign-cicd.yml`) with `concurrency: cancel-in-progress`, 10-minute timeout, and full SHA-256 action pinning.
- Optimize Stage 4 test execution with native test runner batching.
- Author BDD test suite `test/glorianGateSanity.test.mjs` (BDD-366 to BDD-368).

## 3. Epistemic Status
- Current: `INSPECTION_COMPLETE`
- Target: `PRODUCTION_READY`
