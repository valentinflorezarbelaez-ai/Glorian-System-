# CHANGE-136: Kubernetes Gated Deployment Pipeline & k6 SLO Load Testing Engine

## Executive Summary

Implements Phase C of the Glorian Toolchain Control Plane roadmap:

1. **Gated Deployment Governor (`src/core/eosKubernetesDeployGovernor.ts`)**: Orchestrates safe workload deployment against local Kind clusters through a 5-step strict barrier:
   - Barrier 1: Inviolable context guard (`/^kind-/` allowlist).
   - Barrier 2: OPA Rego policy evaluation (`policies/k8s/security_baseline.rego`).
   - Barrier 3: Trivy vulnerability gate (0 CRITICAL CVEs allowed).
   - Barrier 4: Kubernetes server-side dry run (`kubectl apply --dry-run=server`).
   - Barrier 5: Explicit apply authorization (`--yes` or confirmed write).
2. **k6 Load Testing Engine (`src/core/eosK6LoadTestAdapter.ts`)**: Executes k6 performance benchmarks against cluster and gateway endpoints with P95/P99 latency thresholds and error budget checks.
3. **CLI Hygiene & Parity**: Introduces `eos toolchain:deploy` and `eos toolchain:loadtest`, bringing the catalog count from 352 to 354 registered and documented commands.

## Scope & Delta

- **Files Added**:
  - `docs/intake/eos-system/INTAKE-136-K8S-DEPLOYMENT-AND-K6-LOADTEST.md`
  - `openspec/changes/CHANGE-136-k8s-deployment-and-k6-loadtest.md`
  - `openspec/specs/SPEC-274-K8S-DEPLOYMENT-AND-K6-LOADTEST.md`
  - `docs/plans/PLAN-136-K8S-DEPLOYMENT-AND-K6-LOADTEST.md`
  - `docs/tasks/TASKS-136-K8S-DEPLOYMENT-AND-K6-LOADTEST.md`
  - `src/core/eosKubernetesDeployGovernor.ts`
  - `src/core/eosK6LoadTestAdapter.ts`
  - `test/eosKubernetesDeployAndK6LoadTest.test.mjs`
- **Files Modified**:
  - `src/core/index.ts`: export new modules.
  - `bin/commands/cliDevOps.mjs`: wire `toolchain:deploy` and `toolchain:loadtest`.
  - `bin/commands/cliHelpCatalog.mjs`: document new commands.
  - `docs/DEVELOPER_GUIDE.md`: document new commands and update count to 354.
