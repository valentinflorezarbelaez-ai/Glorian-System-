# TASKS-137: Helm Packaging & Release Governor

## Task DAG & Implementation Checklist

- [ ] **TASK-137-01**: Create enterprise Helm chart template in `templates/k8s/glorian-enterprise-workload`.
  - Done criteria: `Chart.yaml`, `values.yaml`, `templates/deployment.yaml`, `templates/service.yaml`, `templates/serviceaccount.yaml` created with non-root UID 10001, drop ALL, limits set.
- [ ] **TASK-137-02**: Implement `src/core/eosHelmReleaseGovernor.ts`.
  - Done criteria: Pure Layer-0 TypeScript class exposing `lintChart`, `templateChart`, `auditChartWithOpa`, `deployChart`, returning structured reports with SHA-256 receipts.
- [ ] **TASK-137-03**: Export `EosHelmReleaseGovernor` from `src/core/index.ts`.
  - Done criteria: `src/core/index.ts` exports module cleanly; line count <= 744.
- [ ] **TASK-137-04**: Implement CLI commands in `bin/commands/cliDevOps.mjs`.
  - Done criteria: `toolchain:helm:lint`, `toolchain:helm:template`, `toolchain:helm:deploy` wired; file lines <= 744.
- [ ] **TASK-137-05**: Update help catalogs and developer documentation.
  - Done criteria: `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` updated from 354 to 357 commands.
- [ ] **TASK-137-06**: Implement automated test suite `test/eosHelmReleaseGovernor.test.mjs`.
  - Done criteria: BDD-1425 through BDD-1430 pass 100%.
- [ ] **TASK-137-07**: Execute live Helm deployment against local Kind cluster and collect evidence receipt `docs/evidence/HELM_RECEIPT.json`.
  - Done criteria: Live release deployed into `kind-glorian-cluster` and verified with `helm list`.
