# CHANGE-073: Gate Sanity, SARIF Truth & Strict CI Unification

## Change Metadata
- **Change ID**: `CHANGE-073`
- **Spec Reference**: `SPEC-138`
- **Component**: `Glorian Control Plane (scripts/ & .github/)`
- **Author**: Principal Architect Valentín Flórez Arbeláez
- **Status**: `PROPOSED`

## Summary of Delta
1. **SARIF Truth & Fail-Safe Emission**:
   - `scripts/verify-cicd-pipeline.mjs` accumulates findings across all verification stages.
   - Guaranteed atomic write of `docs/evidence/local-checks.sarif` in `finally` block.
   - Elimination of hardcoded `results: []`.
   - Exit code 1 when findings exist.
2. **Attestation Alignment**:
   - `scripts/eos-github-pr-attestation.mjs` leverages `scripts/eos-secret-scan.mjs` across all repository files.
   - Enforce `assert.equal(compliantSpecs, specFiles.length)`.
3. **Workflow Hardening**:
   - Consolidate `.github/workflows/` into `eos-sovereign-cicd.yml`.
   - Concurrency group with `cancel-in-progress: true`.
   - 100% full SHA pinning on all GitHub Actions.
   - Node 22 / 24 alignment.
4. **Automated Verification**:
   - `test/glorianGateSanity.test.mjs` covering BDD-366, BDD-367, BDD-368.
