# TASKS-136: Atomic Execution DAG for Phase C Deployment & Load Testing

```mermaid
graph TD
  T1[T-136-01: Kubernetes Deploy Governor Core] --> T3[T-136-03: CLI Integration toolchain:deploy & toolchain:loadtest]
  T2[T-136-02: k6 Load Test Adapter Core] --> T3
  T3 --> T4[T-136-04: CLI Hygiene & Catalog Parity 354 Commands]
  T4 --> T5[T-136-05: Test Suite BDD-1419..1424]
  T5 --> T6[T-136-06: Full CI/CD 7-Stage Pipeline Verification & Push]
```

## Atomic Tasks

- [x] **T-136-01**: Implement `src/core/eosKubernetesDeployGovernor.ts` orchestrating Context Guard -> OPA Rego -> Server Dry-Run -> Explicit Apply with cryptographic receipts.
- [x] **T-136-02**: Implement `src/core/eosK6LoadTestAdapter.ts` with ephemeral script synthesis, k6 execution, SLO metrics extraction, and receipt generation.
- [x] **T-136-03**: Wire subcommands `toolchain:deploy` and `toolchain:loadtest` in `bin/commands/cliDevOps.mjs` and export in `src/core/index.ts`.
- [x] **T-136-04**: Update `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` for CLI hygiene parity (352 -> 354 commands).
- [x] **T-136-05**: Author test suite `test/eosKubernetesDeployAndK6LoadTest.test.mjs` covering BDD-1419 through BDD-1424.
- [x] **T-136-06**: Execute full 7-stage CI/CD pipeline verification, refresh tip, seal freeze pin, and push to `origin/main`.
