# PLAN-138: Architecture Plan — Gate Sanity, SARIF Truth & Strict CI Unification

## 1. Context & Architectural Decisions
- **Decision 1: Accumulator-Pattern for SARIF Diagnostics**
  - *Context*: Currently, `verify-cicd-pipeline.mjs` executes assertions directly. Any failed assert throws an exception and immediately exits the Node process before Stage 7 is reached, leaving `docs/evidence/local-checks.sarif` either absent, stale, or with hardcoded `results: []`.
  - *Decision*: Wrap pipeline stages in a diagnostic accumulator with a master `try ... catch ... finally` block. Failed checks record a SARIF result item with `ruleId`, `message`, `level: "error"`, and `locations`. In `finally`, `docs/evidence/local-checks.sarif` is written atomically. If `findings.length > 0`, `process.exit(1)`.
  - *Rejected Alternative*: Continuing to use naked `assert.ok()` that aborts before report writing.

- **Decision 2: Single Canonical SARIF Writer**
  - *Context*: `scripts/eos-github-pr-attestation.mjs` and `scripts/verify-cicd-pipeline.mjs` both wrote to `docs/evidence/local-checks.sarif` with different schemas, clobbering each other.
  - *Decision*: Centralize SARIF writing in `verify-cicd-pipeline.mjs`. In `eos-github-pr-attestation.mjs`, delegate or synchronize with the master pipeline receipt.

- **Decision 3: Universal Secret Scan Unification**
  - *Context*: `eos-github-pr-attestation.mjs` only checked 4 files (`package.json`, `index.html`, `js/eos.js`, `css/eos.css`) with 3 basic regexes, while `eos-secret-scan.mjs` had 4 comprehensive engines scanning 970+ files.
  - *Decision*: Invoke `scripts/eos-secret-scan.mjs` directly in `eos-github-pr-attestation.mjs`.

- **Decision 4: GitHub Actions Workflow Consolidation**
  - *Context*: Three workflow files (`eos-gate.yml`, `eos-strict-gate.yml`, `eos-sovereign-cicd.yml`) triggered on the same PR/push events.
  - *Decision*: Consolidate all PR/push checks into a unified `eos-sovereign-cicd.yml` with job-level permissions, full SHA-pinned actions, and concurrency cancel-in-progress.

---

## 2. Architecture Boundary Matrix
| Module | Layer | Responsibility |
|---|---|---|
| `scripts/verify-cicd-pipeline.mjs` | Control Plane / CI Gate | 7-Stage master gate with fail-safe SARIF v2.1.0 generation |
| `scripts/eos-secret-scan.mjs` | Security Engine | Universal whole-tree secret scanning (970+ files) |
| `scripts/eos-github-pr-attestation.mjs` | Attestation Engine | GitHub PR gate attestation enforcing Laws I, V, VI |
| `.github/workflows/eos-sovereign-cicd.yml` | Infrastructure / Orchestration | Unified GitHub Actions workflow |
| `test/glorianGateSanity.test.mjs` | Test Suite | BDD regression verification for SPEC-138 |
