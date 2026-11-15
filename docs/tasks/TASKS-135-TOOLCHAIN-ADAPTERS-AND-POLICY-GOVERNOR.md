# TASKS-135: Atomic Execution DAG for Phase B Toolchain Adapters

```mermaid
graph TD
  T1[T-135-01: Rego Security Baseline Policy] --> T2[T-135-02: OPA Policy Governor Module]
  T3[T-135-03: Trivy Scanner Adapter & SARIF Engine] --> T4[T-135-04: Kubectl Cluster Inspector & Context Guard]
  T2 --> T5[T-135-05: CLI & Help Catalog Parity]
  T4 --> T5
  T5 --> T6[T-135-06: Comprehensive Test Suite BDD-1413..1418]
  T6 --> T7[T-135-07: CI/CD Pipeline & Freeze Pin Verification]
```

## Atomic Tasks

- [x] **T-135-01**: Create `policies/k8s/security_baseline.rego` defining rules for non-privileged, runAsNonRoot, CPU/mem limits, and `:latest` tag prohibition.
- [x] **T-135-02**: Implement `src/core/eosOpaPolicyGovernor.ts` with manifest parsing, OPA evaluation, and violation detection.
- [x] **T-135-03**: Implement `src/core/eosTrivyScannerAdapter.ts` with safe `trivy fs` execution, SARIF transformation, threshold gating, and receipt hashing.
- [x] **T-135-04**: Implement `src/core/eosKubectlClusterInspector.ts` with `kind-*` context guard and read-only node/pod telemetry.
- [x] **T-135-05**: Register modules in `src/core/index.ts`, wire CLI subcommands `toolchain:scan`, `toolchain:policy`, `toolchain:k8s` in `bin/commands/cliDevOps.mjs`, and update `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`.
- [x] **T-135-06**: Author test suite `test/eosToolchainAdaptersAndPolicyGovernor.test.mjs` covering BDD-1413 through BDD-1418 with fixtures.
- [x] **T-135-07**: Execute full 7-stage CI/CD pipeline verification, refresh tip, and seal freeze pin.
