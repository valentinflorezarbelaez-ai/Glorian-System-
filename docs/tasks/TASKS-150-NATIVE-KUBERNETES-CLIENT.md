# TASKS-150: Pure REST Kubernetes Client via Native node:https

- **Change ID**: `CHANGE-150`
- **Spec ID**: `SPEC-288`
- **Component**: `Glorian System / Layer-0 Cloud Native Orchestrator`
- **Status**: `READY_FOR_EXECUTION`
- **Date**: 2026-11-15

---

## 1. Task Dependency Graph (DAG)

```text
[Task 1: Declarative Job Spec Template]
                   │
                   ▼
[Task 2: Core Native K8s Client Module] ──► [Task 3: Core Exports]
                   │
                   ▼
[Task 4: CLI Subcommands & Wiring]
                   │
                   ▼
[Task 5: CLI Catalog & Developer Guide]
                   │
                   ▼
[Task 6: Test Suite (BDD-1503..1508)]
                   │
                   ▼
[Task 7: Level 3 Authorization & Audit Gate]
```

---

## 2. Detailed Task Breakdown

### Task 1: Declarative Job Spec Template

- Author `templates/k8s/sample-job-spec.json` with standard Kubernetes `batch/v1` Job specification.

### Task 2: Core Native Kubernetes Client Module

- Author `src/core/eosKubernetesNativeClient.ts`:
  - In-cluster credentials resolver (`/var/run/secrets/kubernetes.io/serviceaccount/`).
  - Custom `https.Agent` with CA certificate trust.
  - Pod lifecycle methods: `listPods`, `getPod`, `deletePod`.
  - Batch Job lifecycle methods: `createJob`, `getJobStatus`, `deleteJob`.
  - Deterministic in-memory simulation mode for offline/local environments.
  - Cryptographic audit receipt emission (`docs/evidence/K8S_NATIVE_RECEIPT.json`).
  - Strict line ceiling $\le 800$ lines.

### Task 3: Core Export Integration

- Export `EosKubernetesNativeClient` and types in `src/core/index.ts`.

### Task 4: CLI Subcommands & Wiring

- Author `bin/commands/cliK8sNative.mjs`:
  - `toolchain:k8s:audit`: Audit cluster configuration and emit receipt.
  - `toolchain:k8s:pods`: List pods in namespace.
  - `toolchain:k8s:job`: Submit batch Job from JSON file or template.
- Wire dynamic delegation in `bin/commands/cliDevOps.mjs`.

### Task 5: Catalog Registration & Documentation

- Register subcommands in `bin/commands/cliHelpCatalog.mjs`.
- Document usage in `docs/DEVELOPER_GUIDE.md`.

### Task 6: Test Suite Authoring & Execution

- Author `test/eosKubernetesNativeClient.test.mjs` validating BDD-1503..BDD-1508.
- Run tests with `node --test test/eosKubernetesNativeClient.test.mjs`.

### Task 7: Authorization & Verification

- Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- Run `npm run hygiene:audit`.
- Seal freeze pin and push.
