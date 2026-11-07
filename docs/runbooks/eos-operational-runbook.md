# EOS Operational Runbook

<!-- Google SRE standard (https://sre.google/sre-book/operational-readiness/).
     Step-by-step procedures for common operational scenarios. Every procedure
     should be executable by an on-call engineer without additional context. -->

## On-Call Procedures

### 1. CI Gate Failure

**Symptom**: A PR fails the 7-stage SecDevOps pipeline.

1. Read the failing stage in the GitHub Actions log.
2. Reproduce locally: `npm run check` (typecheck + lint + format + test).
3. If it's a type error: fix the type, re-run `npm run typecheck`.
4. If it's a test failure: read the test name (BDD-XXX), find the spec, fix
   the implementation or the test.
5. If it's a secret scan: check `.eos/secret-allowlist.json` — is the finding
   a false positive? If so, add the fingerprint to the allowlist with an expiry
   date. If real, remove the secret immediately.
6. Re-run `npm run verify:fast` to confirm the fix before pushing.

### 2. Flaky Test Detected

**Symptom**: The nightly flaky gate reports a new flaky test.

1. Read the flaky test report from the nightly workflow job summary.
2. Reproduce locally: `npm run flaky:gate -- --repeat=10`.
3. If the flakiness is time-dependent (Law VII violation): replace `Date.now()`
   with an injectable clock or seeded PRNG.
4. If the flakiness is race-condition: add proper synchronization (await,
   Promise.all, or sequential execution).
5. If you can't fix it immediately: add it to `docs/quality/flaky-budget.json`
   with an owner and expiry date (max 14 days).
6. Run `npm run flaky:gate -- --update` to shrink the quarantine.

### 3. Mutation Test Regression

**Symptom**: The nightly mutation gate reports a score below the ratchet floor.

1. Read the mutation report — which target file's score dropped?
2. Run locally: `npm run mutation:gate` to reproduce.
3. Look at the surviving mutants — what mutations weren't caught by tests?
4. Add test cases that kill the surviving mutants.
5. Run `npm run mutation:gate -- --update` to raise the floor.

### 4. Coverage Below Threshold

**Symptom**: The coverage gate fails (Line < 80%, Branch < 65%, Func < 75%).

1. Read the coverage report from the CI job summary.
2. Run locally: `npm run test:coverage` to see detailed coverage.
3. Identify the uncovered lines/branches/functions.
4. Add tests that exercise the uncovered paths.
5. Re-run `npm run test:coverage` to confirm.

### 5. CSP Violation Report

**Symptom**: CSP violation reports appear at `/api/csp-report`.

1. Read the violation — what directive was violated? What resource was blocked?
2. If it's a false positive (legitimate inline script): move the script to an
   external file or add a hash to the CSP.
3. If it's an actual XSS attempt: investigate the source of the malicious input.
4. Update `vercel.json` CSP directives if needed.

### 6. Bundle Size Budget Exceeded

**Symptom**: The bundle size gate fails.

1. Read the report — which file exceeded its ceiling?
2. If `js/eos.js`: check if new code was added that bloated the bundle. Consider
   code splitting or tree-shaking.
3. If `css/eos.css`: check for new CSS rules. Remove unused styles.
4. If the increase is intentional: run `npm run bundle:budget -- --update` to
   refresh the ratchet baseline.

## Escalation

| Severity | Response Time | Escalate To              |
| -------- | ------------- | ------------------------ |
| P0       | 5 min         | Project lead immediately |
| P1       | 30 min        | Project lead             |
| P2       | 4 hours       | Next business day        |
| P3       | 1 day         | Backlog                  |
