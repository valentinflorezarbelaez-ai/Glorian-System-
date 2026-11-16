# PLAN-150: Pure REST Kubernetes Client via Native node:https

- **Change ID**: `CHANGE-150`
- **Spec ID**: `SPEC-288`
- **Component**: `Glorian System Core / Cloud-Native Kubernetes Interface`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`
- **Date**: 2026-11-15

---

## 1. Architectural Strategy & Design Patterns

### 1.1 In-Cluster Authentication Pattern

Inside a Kubernetes Pod, the `kubelet` automatically mounts service account credentials:

- Token: `/var/run/secrets/kubernetes.io/serviceaccount/token`
- CA Bundle: `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`
- Namespace: `/var/run/secrets/kubernetes.io/serviceaccount/namespace`

The client reads these files synchronously on startup. If present:

```typescript
const httpsAgent = new https.Agent({
  ca: fs.readFileSync(caPath),
  keepAlive: true,
});
```

Every request sends:

```http
Authorization: Bearer <token>
Accept: application/json
Content-Type: application/json
```

### 1.2 Dual Mode Engine: Live HTTPS vs In-Memory Simulator

To satisfy Law V and ensure 100% offline self-containment for testing and local development:

1. **LIVE_CLUSTER**: Uses `node:https` to execute HTTP calls against `https://kubernetes.default.svc` or custom cluster endpoint.
2. **SIMULATOR**: Maintains an internal in-memory object store for namespaces, pods, and jobs with full Kubernetes v1 JSON structure, enabling deterministic local unit testing without spinning up Minikube or Kind.

---

## 2. Architecture Decision Records (ADR)

### ADR-150.1: Native `node:https` vs `@kubernetes/client-node`

- **Context**: Official `@kubernetes/client-node` pulls over 50 transitive npm dependencies (`axios`, `ws`, `js-yaml`, etc.), breaching Law V (`dependencies: {}`).
- **Decision**: Author a focused REST client directly over Node.js's built-in `node:https` module.
- **Status**: ACCEPTED.
- **Consequences**: Zero external dependencies, ultra-fast cold start, zero bundle weight, and immune to third-party CVEs.

### ADR-150.2: Built-in Mock Simulator for Local Development

- **Context**: Developers and CI runners often run in environments without a live Kubernetes API server.
- **Decision**: Implement built-in simulation mode that activates when in-cluster secrets are absent or when explicitly requested via `simulationMode: true`.
- **Status**: ACCEPTED.
- **Consequences**: Deterministic test suites in CI with zero external daemon requirements.
