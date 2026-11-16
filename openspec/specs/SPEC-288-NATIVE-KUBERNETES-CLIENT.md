# SPEC-288: Pure REST Kubernetes Client via Native node:https

- **Specification ID**: `SPEC-288`
- **Change ID**: `CHANGE-150`
- **Status**: `APPROVED`
- **Module**: `src/core/eosKubernetesNativeClient.ts`
- **Tier**: Cloud Native Orchestration / Kubernetes Layer-0 Interface
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-288-01 (Event-Driven In-Cluster Credential Discovery)**: WHEN the Kubernetes client initializes, THE SYSTEM SHALL attempt to load the service account token from `/var/run/secrets/kubernetes.io/serviceaccount/token` and CA certificate from `ca.crt`, falling back gracefully to environment variables or mock simulation mode.
- **FR-288-02 (State-Driven HTTPS Agent)**: WHILE executing API requests against a live cluster, THE SYSTEM SHALL construct a custom `https.Agent` configured with the cluster's CA bundle, injecting `Authorization: Bearer <token>` and `Accept: application/json` headers into all requests.
- **FR-288-03 (Pod Lifecycle Management)**: WHEN querying or mutating Pods, THE SYSTEM SHALL execute standard Kubernetes REST endpoints (`/api/v1/namespaces/{ns}/pods`) returning strongly-typed `PodList` objects.
- **FR-288-04 (Ephemeral Batch Job Orchestration)**: WHEN a validation or build task is scheduled, THE SYSTEM SHALL POST to `/apis/batch/v1/namespaces/{ns}/jobs`, monitor completion status, and clean up completed resources.
- **FR-288-05 (Fail-Safe Simulation & Air-Gap Mode)**: SI no live cluster connection or valid service account token is accessible, ENTONCES EL SISTEMA SHALL operate in deterministic mock simulation mode maintaining in-memory state with authentic Kubernetes JSON schemas.
- **FR-288-06 (Cryptographic Attestation Receipt)**: WHEN a cluster audit completes, THE SYSTEM SHALL emit a cryptographic receipt at `docs/evidence/K8S_NATIVE_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1503 In-Cluster Credential Resolution and CA Certificate Loading
  GIVEN an EosKubernetesNativeClient configured with filesystem path overrides
  WHEN client initializes
  THEN it successfully reads the service account token and CA certificate
  AND establishes the correct cluster endpoint URL (https://kubernetes.default.svc).

SCENARIO: BDD-1504 Pod List Query with Namespace Isolation
  GIVEN a Kubernetes cluster with Pods in default and kube-system namespaces
  WHEN listPods is invoked with namespace "default"
  THEN only Pods belonging to the "default" namespace are returned
  AND each Pod contains metadata (name, namespace, status, phase).

SCENARIO: BDD-1505 Ephemeral Batch Job Creation and Status Polling
  GIVEN a valid Kubernetes Job manifest specifying an agent verification container
  WHEN createJob is executed under namespace "default"
  THEN the Job resource is instantiated with status "Active"
  AND status polling returns succeeded or failed conditions.

SCENARIO: BDD-1506 Deterministic Simulation Mode in Offline / Air-Gapped Environments
  GIVEN an EosKubernetesNativeClient initialized with simulationMode: true
  WHEN Pods and Jobs are created and queried
  THEN all operations succeed deterministically in-memory without network socket errors
  AND returned schemas match official Kubernetes v1 JSON specifications.

SCENARIO: BDD-1507 Resource Deletion and Cleanup
  GIVEN an active Pod or completed Job in the cluster
  WHEN deletePod or deleteJob is invoked with a grace period
  THEN the resource is removed and subsequent GET requests return 404 or null.

SCENARIO: BDD-1508 Cryptographic Audit Receipt Verification
  GIVEN a cluster inspection executed via toolchain:k8s:audit
  WHEN the audit completes
  THEN docs/evidence/K8S_NATIVE_RECEIPT.json is written
  AND contains clusterEndpoint, inClusterAuth, totalPods, activeJobs, and a valid sha256Signature.
```
