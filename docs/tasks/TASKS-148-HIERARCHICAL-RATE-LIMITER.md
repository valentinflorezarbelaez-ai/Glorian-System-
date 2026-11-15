# TASKS-148: Hierarchical Multi-Algorithm Rate Limiting & Traffic Shaping Governor

- **Change ID**: `CHANGE-148`
- **Spec ID**: `SPEC-286`
- **Component**: `Glorian System / Layer-0 Concurrency & Traffic Control`
- **Status**: `READY_FOR_EXECUTION`
- **Date**: 2026-11-15

---

## 1. Task Dependency Graph (DAG)

```text
[Task 1: Templates & Policies]
             │
             ▼
[Task 2: Core Governor Module] ──► [Task 3: Core Exports]
             │
             ▼
[Task 4: CLI Subcommands & Wiring]
             │
             ▼
[Task 5: CLI Catalog & Developer Guide]
             │
             ▼
[Task 6: Test Suite (BDD-1491..1496)]
             │
             ▼
[Task 7: Level 3 Authorization & Audit Gate]
```

---

## 2. Detailed Task Breakdown

### Task 1: Sample Rate Limiter Policy Template

- Create `templates/concurrency/sample-rate-limit-policy.json` declaring sample Token Bucket and Leaky Bucket hierarchical configurations.

### Task 2: Core Rate Limiting Governor Implementation

- Author `src/core/eosRateLimitingGovernor.ts`:
  - Token Bucket with burst capacity and refill rate.
  - Leaky Bucket with queue capacity and drain rate.
  - Multi-tier cascading evaluation (`global` $\to$ `tenant` $\to$ `client` $\to$ `endpoint`).
  - Monotonic nanosecond timing calculation.
  - RFC 6585 header generation (`Retry-After`, `X-RateLimit-*`).
  - Cryptographic receipt generation at `docs/evidence/RATE_LIMITER_RECEIPT.json`.
  - Maintain line count strictly $\le 800$ lines.

### Task 3: Core Export Integration

- Export `EosRateLimitingGovernor` and related types in `src/core/index.ts`.

### Task 4: CLI Subcommands & Wiring

- Author `bin/commands/cliRateLimit.mjs`:
  - `toolchain:ratelimit:audit`: Execute multi-tier simulation and generate cryptographic receipt.
  - `toolchain:ratelimit:consume`: Consume tokens/drops against domain keys and output RFC 6585 headers.
  - `toolchain:ratelimit:inspect`: Inspect state of domain buckets.
- Wire dynamic import in `bin/commands/cliDevOps.mjs`.

### Task 5: Catalog Registration & Documentation

- Register subcommands in `bin/commands/cliHelpCatalog.mjs`.
- Document usage in `docs/DEVELOPER_GUIDE.md`.

### Task 6: Test Suite Authoring & Execution

- Author `test/eosRateLimitingGovernor.test.mjs` validating BDD-1491..BDD-1496.
- Run tests with `node --test test/eosRateLimitingGovernor.test.mjs`.

### Task 7: Authorization & Verification

- Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- Run `npm run hygiene:audit`.
- Seal freeze pin and commit.
