# CHANGE-137: Helm Packaging & Release Governor

## Executive Summary

Implements Phase D1 of the Glorian Sovereign Enterprise Control Plane:

1. **Helm Release Governor (`src/core/eosHelmReleaseGovernor.ts`)**:
   - `lintChart(chartPath)`: Executes `helm lint` with strict formatting and validation.
   - `templateChart(chartPath, values?)`: Renders full multi-resource Kubernetes YAML manifests in memory.
   - `auditChartWithOpa(renderedYaml, policyPath?)`: Passes every rendered Kubernetes resource from the chart through the OPA security baseline (`policies/k8s/security_baseline.rego`).
   - `deployChart(chartPath, releaseName, options)`: 5-stage admission gate into local Kind cluster (`kind-*`), server-side dry run, and explicit apply authorization (`--yes`).
   - Generates cryptographic SHA-256 execution receipt (`docs/evidence/HELM_RECEIPT.json`).
2. **Enterprise Helm Chart Template (`templates/k8s/glorian-enterprise-workload`)**:
   - Production-ready, OPA-compliant Helm chart with non-root UID 10001, drop ALL capabilities, readOnlyRootFilesystem, and explicit CPU/memory limits.
3. **CLI Hygiene & Parity**:
   - Introduces `eos toolchain:helm:lint`, `eos toolchain:helm:template`, and `eos toolchain:helm:deploy`.
   - Increases governed CLI commands catalog from 354 to 357.

## Scope & Delta

- **Files Added**:
  - `docs/intake/eos-system/INTAKE-137-HELM-RELEASE-GOVERNOR.md`
  - `openspec/changes/CHANGE-137-helm-release-governor.md`
  - `openspec/specs/SPEC-275-HELM-RELEASE-GOVERNOR.md`
  - `docs/plans/PLAN-137-HELM-RELEASE-GOVERNOR.md`
  - `docs/tasks/TASKS-137-HELM-RELEASE-GOVERNOR.md`
  - `src/core/eosHelmReleaseGovernor.ts`
  - `templates/k8s/glorian-enterprise-workload/Chart.yaml`
  - `templates/k8s/glorian-enterprise-workload/values.yaml`
  - `templates/k8s/glorian-enterprise-workload/templates/deployment.yaml`
  - `templates/k8s/glorian-enterprise-workload/templates/service.yaml`
  - `templates/k8s/glorian-enterprise-workload/templates/serviceaccount.yaml`
  - `test/eosHelmReleaseGovernor.test.mjs`
- **Files Modified**:
  - `src/core/index.ts`: export `EosHelmReleaseGovernor`.
  - `bin/commands/cliDevOps.mjs`: wire `toolchain:helm:lint`, `toolchain:helm:template`, and `toolchain:helm:deploy`.
  - `bin/commands/cliHelpCatalog.mjs`: document new commands.
  - `docs/DEVELOPER_GUIDE.md`: document new commands and update count to 357.
