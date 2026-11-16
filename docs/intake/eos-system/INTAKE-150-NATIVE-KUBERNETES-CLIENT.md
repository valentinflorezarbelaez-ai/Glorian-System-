# INTAKE-150: Pure REST Kubernetes Client via Native node:https

- **Change ID**: `CHANGE-150`
- **Specification ID**: `SPEC-288`
- **Module ID**: `EosKubernetesNativeClient`
- **Domain**: Cloud Native Orchestration, Ephemeral Validation Jobs & Pod Lifecycle Governance
- **System Owner**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-11-15

---

## 1. Context & Operational Baseline

In enterprise cloud-native environments and Kubernetes clusters, orchestrating ephemeral build sandboxes, test-runner Jobs, and verifying Pod health typically relies on bulky third-party libraries such as `@kubernetes/client-node` or external `kubectl` subprocess binaries. These libraries introduce heavy dependency trees (violating Law V) or fail in air-gapped container runtimes where the `kubectl` binary is not installed in the container image.

The Kubernetes API server is an RFC-compliant HTTPS REST service. Every Pod running within a Kubernetes cluster automatically receives:

1. Service account bearer token: `/var/run/secrets/kubernetes.io/serviceaccount/token`.
2. Cluster Certificate Authority (CA) root: `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`.
3. In-cluster DNS / environment variables: `KUBERNETES_SERVICE_HOST` and `KUBERNETES_SERVICE_PORT`.

Glorian System requires a zero-dependency, pure Layer-0 native HTTPS client leveraging Node.js `node:https` and `node:crypto` to interact directly with the Kubernetes API server for Pod listing, Job execution, namespace auditing, and cryptographic attestation receipt emission.

---

## 2. Requirements Baseline (EARS Syntax)

- **FR-288-01 (Event-Driven In-Cluster Credential Discovery)**: WHEN the Kubernetes client initializes, THE SYSTEM SHALL attempt to load the service account token from `/var/run/secrets/kubernetes.io/serviceaccount/token` and CA certificate from `ca.crt`, falling back gracefully to environment variables or mock simulation mode.
- **FR-288-02 (State-Driven HTTPS Agent)**: WHILE executing API requests against a live cluster, THE SYSTEM SHALL construct a custom `https.Agent` configured with the cluster's CA bundle, injecting `Authorization: Bearer <token>` and `Accept: application/json` headers into all requests.
- **FR-288-03 (Pod Lifecycle Management)**: WHEN querying or mutating Pods, THE SYSTEM SHALL execute standard Kubernetes REST endpoints (`/api/v1/namespaces/{ns}/pods`) returning strongly-typed `PodList` objects.
- **FR-288-04 (Ephemeral Batch Job Orchestration)**: WHEN a validation or build task is scheduled, THE SYSTEM SHALL POST to `/apis/batch/v1/namespaces/{ns}/jobs`, monitor completion status, and clean up completed resources.
- **FR-288-05 (Fail-Safe Simulation & Air-Gap Mode)**: SI no live cluster connection or valid service account token is accessible, ENTONCES EL SISTEMA SHALL operate in deterministic mock simulation mode maintaining in-memory state with authentic Kubernetes JSON schemas.
- **FR-288-06 (Cryptographic Attestation Receipt)**: WHEN a cluster audit completes, THE SYSTEM SHALL emit a cryptographic receipt at `docs/evidence/K8S_NATIVE_RECEIPT.json` sealed with a SHA-256 signature.

---

## 3. Epistemic Assessment & Deliverables

- **Epistemic State**: `INTAKE_RECORDED`
- **Target Implementation**: `src/core/eosKubernetesNativeClient.ts`
- **CLI Subcommands**: `toolchain:k8s:audit`, `toolchain:k8s:pods`, `toolchain:k8s:job`
- **Test Suite**: `test/eosKubernetesNativeClient.test.mjs` (BDD-1503..BDD-1508)
