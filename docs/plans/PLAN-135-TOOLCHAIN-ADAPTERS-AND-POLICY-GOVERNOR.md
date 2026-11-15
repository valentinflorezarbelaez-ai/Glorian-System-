# PLAN-135: Architecture & Design Plan for Phase B Toolchain Adapters

## 1. System Architecture Overview

Phase B establishes operational read-only execution wrappers behind strict isolation boundaries:

1. `src/core/eosTrivyScannerAdapter.ts`:
   - Inspects target paths via `trivy fs --format json`.
   - Normalizes Trivy JSON output into a vendor-neutral schema (`TrivyScanReport`).
   - Converts findings into OASIS SARIF v2.1.0 (`convertTrivyToSarif`).
   - Evaluates severity thresholds (`evaluateScanVerdict`).
2. `src/core/eosOpaPolicyGovernor.ts` & `policies/k8s/security_baseline.rego`:
   - Evaluates input YAML/JSON Kubernetes manifests using `opa eval` or native AST checks.
   - Four fundamental rules:
     - `no_privileged`: Containers with `securityContext.privileged: true` are blocked.
     - `run_as_non_root`: Containers must run as non-root.
     - `require_resource_limits`: Every container must declare `resources.limits.cpu` and `resources.limits.memory`.
     - `disallow_latest_tag`: Images using `:latest` or missing tags are blocked.
3. `src/core/eosKubectlClusterInspector.ts`:
   - Reads current context using `kubectl config current-context`.
   - Enforces context allowlist (`/^kind-/`). If not matched, returns `CONTEXT_UNAUTHORIZED`.
   - Fetches node and pod status using `kubectl get nodes -o json` and `kubectl get pods -A -o json`.
   - Aggregates health telemetry.

---

## 2. Architecture Decision Records (ADRs)

### ADR-135-001: Pure TypeScript Layer-0 Toolchain Adapters via Safe `spawnSync`

- **Context**: Toolchain adapters must interact with external binaries without compromising Layer-0 purity or security.
- **Decision**: All process invocations must use `node:child_process` `spawnSync` with discrete argument arrays (no shell interpretation), strict timeouts (default <= 10000ms), and sanitized environment variables.
- **Consequences**: Zero npm dependencies added (Law V). Immune to shell injection vulnerabilities.

### ADR-135-002: Inviolable `kind-*` Context Guard for Kubernetes Telemetry

- **Context**: The user's host machine may contain `kubeconfig` contexts pointing to cloud or corporate Kubernetes clusters (EKS, GKE, AKS). Automated scripts must NEVER query or affect non-local clusters.
- **Decision**: By default, only contexts matching the regular expression `/^kind-/` are authorized. Any other context triggers immediate fail-closed abort with `CONTEXT_UNAUTHORIZED`.
- **Consequences**: Absolute safety against accidental external cluster interaction.

### ADR-135-003: Declarative Rego Baseline in `policies/k8s/` with Offline Fallback

- **Context**: Kubernetes manifest compliance must be verifiable both with `opa` binary installed and in air-gapped or mock test environments.
- **Decision**: Author declarative Rego policy files in `policies/k8s/security_baseline.rego`. If `opa` CLI is available, execute `opa eval --data policies/k8s --input <manifest>`. Provide deterministic JS parsing fallback for offline testing.
- **Consequences**: 100% testable in CI and local dev without external daemon dependencies.
