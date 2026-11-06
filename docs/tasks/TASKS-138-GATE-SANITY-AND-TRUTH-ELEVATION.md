# TASKS-138: Atomic Task DAG — Gate Sanity, SARIF Truth & Strict CI Unification

## Task DAG
```text
Task 1: Sane SARIF Accumulation in verify-cicd-pipeline.mjs
  ↳ Task 2: Harmonize eos-github-pr-attestation.mjs with Universal Secret Scan & Strict EARS
    ↳ Task 3: Consolidate GitHub Actions Workflows into Single Hardened Pipeline
      ↳ Task 4: Author Regression Test Suite test/glorianGateSanity.test.mjs
        ↳ Task 5: Execute Full 7-Stage Strict Verification & Seal Evidence Receipt
```

### Task 1: Sane SARIF Accumulation in verify-cicd-pipeline.mjs
- **Goal**: Wrap execution in `try ... catch ... finally`. Accumulate real diagnostic findings.
- **Done Criteria**: `docs/evidence/local-checks.sarif` written in `finally`; contains real findings if any stage fails; exits with code 1 on failure.

### Task 2: Harmonize eos-github-pr-attestation.mjs
- **Goal**: Connect `scripts/eos-secret-scan.mjs` instead of 4-file candidate scan. Enforce `assert.equal(compliantSpecs, specFiles.length)`.
- **Done Criteria**: Exits with error if secret detected or if `compliantSpecs !== specFiles.length`.

### Task 3: Consolidate GitHub Actions Workflows
- **Goal**: Deprecate/merge `eos-gate.yml` and `eos-strict-gate.yml` into `eos-sovereign-cicd.yml`.
- **Done Criteria**: Single entry point for CI with `concurrency: cancel-in-progress`, SHA-256 pinned actions, and 10-minute timeout.

### Task 4: Author Regression Test Suite
- **Goal**: Write `test/glorianGateSanity.test.mjs` verifying BDD-366, BDD-367, BDD-368.
- **Done Criteria**: Tests pass cleanly with `node --test test/glorianGateSanity.test.mjs`.

### Task 5: Execute Strict Verification & Record Evidence
- **Goal**: Run `npm run verify:strict`, ensure exit code 0, and record `docs/evidence/EVD-SPEC-138.json`.
- **Done Criteria**: Clean exit code 0, 7/7 stages passing.
