# CHANGE-150: Pure REST Kubernetes Client via Native node:https

- **Change ID**: `CHANGE-150`
- **Spec ID**: `SPEC-288`
- **Component**: `Glorian System / Cloud-Native Kubernetes Orchestrator`
- **Lifecycle**: `PROPOSED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Target Release**: `v45.0.0`
- **Dependencies**: None (Zero Layer-0 external dependencies; pure `node:https`)

---

## 1. Motivation & Problem Statement

Integrating Kubernetes into Glorian System without breaking Law V (`dependencies: {}`) requires bypassing npm client libraries like `@kubernetes/client-node` while maintaining standard Kubernetes API compliance. By implementing a lightweight REST client over Node.js's native `node:https` and `node:crypto` modules, Glorian System can discover in-cluster ServiceAccount credentials, communicate securely with `kube-apiserver`, trigger ephemeral batch Jobs, monitor Pods, and verify cluster health across bare-metal and cloud environments.

`CHANGE-150` introduces `EosKubernetesNativeClient`, providing:

1. Native discovery of `/var/run/secrets/kubernetes.io/serviceaccount/` token and CA cert.
2. Custom HTTPS Agent with strict TLS certificate verification against the cluster CA.
3. RESTful operations on `/api/v1/pods` and `/apis/batch/v1/jobs`.
4. High-fidelity in-memory simulation mode for local, offline, and unit test environments.
5. Cryptographic audit receipts at `docs/evidence/K8S_NATIVE_RECEIPT.json`.

---

## 2. Delta Specification

- **Added Files**:
  - `src/core/eosKubernetesNativeClient.ts`: Core native Kubernetes REST client and simulator.
  - `bin/commands/cliK8sNative.mjs`: CLI command handlers (`audit`, `pods`, `job`).
  - `test/eosKubernetesNativeClient.test.mjs`: BDD test suite covering BDD-1503..BDD-1508.
  - `templates/k8s/sample-job-spec.json`: Declarative batch Job manifest template.
- **Modified Files**:
  - `src/core/index.ts`: Export `EosKubernetesNativeClient` and types.
  - `bin/commands/cliDevOps.mjs`: Dynamic delegation for `toolchain:k8s:`.
  - `bin/commands/cliHelpCatalog.mjs`: Catalog new subcommands.
  - `docs/DEVELOPER_GUIDE.md`: Document CLI usage and examples.
  - `IMPLEMENTATION_AUTHORIZATION.md`: Record Level 3 authorization.

---

## 3. Verification Plan

- Unit & BDD tests with `node --test test/eosKubernetesNativeClient.test.mjs`.
- In-memory simulation testing and live credential discovery mocking.
- Validation of Job submission, status polling, and deletion lifecycle.
- Full 7-stage CI/CD gate validation.
