# CHANGE-135: Toolchain Adapters, Kubernetes Security Policy & Cluster Safety Guard

## Executive Summary

Implements Phase B of the Glorian Toolchain Control Plane roadmap:

1. **Trivy Scanner Adapter (`src/core/eosTrivyScannerAdapter.ts`)**: Safe inspection for filesystem vulnerabilities, normalizing findings, exporting OASIS SARIF 2.1.0, and enforcing fail-closed thresholds on `CRITICAL` CVEs.
2. **OPA Policy Governor (`src/core/eosOpaPolicyGovernor.ts` & `policies/k8s/`)**: Declarative Rego policy evaluation for Kubernetes security standards (non-root execution, privilege escalation denial, resource limit enforcement, immutable image tags).
3. **Safe Kubernetes Cluster Inspector (`src/core/eosKubectlClusterInspector.ts`)**: Read-only cluster telemetry strictly bounded to `kind-*` contexts, blocking non-kind clusters fail-closed.
4. **Ergonomic CLI Integration**: Subcommands wired under `eos toolchain:scan`, `eos toolchain:policy`, and `eos toolchain:k8s`.

## Scope & Delta

- **Files Added**:
  - `docs/intake/eos-system/INTAKE-135-TOOLCHAIN-ADAPTERS-AND-POLICY-GOVERNOR.md`
  - `openspec/changes/CHANGE-135-toolchain-adapters-and-policy-governor.md`
  - `openspec/specs/SPEC-273-TOOLCHAIN-ADAPTERS-AND-POLICY-GOVERNOR.md`
  - `docs/plans/PLAN-135-TOOLCHAIN-ADAPTERS-AND-POLICY-GOVERNOR.md`
  - `docs/tasks/TASKS-135-TOOLCHAIN-ADAPTERS-AND-POLICY-GOVERNOR.md`
  - `policies/k8s/security_baseline.rego`
  - `src/core/eosTrivyScannerAdapter.ts`
  - `src/core/eosOpaPolicyGovernor.ts`
  - `src/core/eosKubectlClusterInspector.ts`
  - `test/eosToolchainAdaptersAndPolicyGovernor.test.mjs`
- **Files Modified**:
  - `bin/commands/cliDevOps.mjs`: CLI subcommands dispatch.
  - `bin/commands/cliHelpCatalog.mjs`: Catalog parity.
  - `docs/DEVELOPER_GUIDE.md`: Documentation synchronization.
  - `src/core/index.ts`: Export of new Layer-0 modules.
  - `docs/releases/EOS_FREEZE_GATE_STATUS.md`: Freeze gate status.
  - `docs/specs/openspec-catalog-index.json`: Catalog index (273 specs).
  - `AGENTS.md`: Update active specs to 273.

## Architectural Invariants Preserved

- `dependencies: {}` (Law V).
- Vercel function count = 12 (SPEC-269).
- Max lines per module <= 744.
- Max cyclomatic complexity <= 15.
