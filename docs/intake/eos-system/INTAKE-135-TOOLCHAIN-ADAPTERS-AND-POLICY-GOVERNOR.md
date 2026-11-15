# INTAKE-135: Toolchain Adapters & Policy Governor (Phase B)

## 1. Context & Business Intent

Following the successful completion of `SPEC-272` / `CHANGE-134` (Phase A Toolchain Control Plane), Glorian System requires operational read-only adapters for external engineering tools:

1. **Trivy**: Automated vulnerability scanning of repository filesystems and container images with SARIF generation.
2. **OPA (Open Policy Agent)**: Declarative Rego policy evaluation enforcing Kubernetes security baselines (no privileged containers, `runAsNonRoot`, strict CPU/memory limits, prohibited `:latest` image tag).
3. **Kubectl / Kind**: Safe cluster telemetry and status inspection bounded by an inviolable context guard that restricts automated operations to local `kind-*` clusters, preventing accidental execution against staging or production Kubernetes clusters.

## 2. Stakeholders & User Directives

- **Directive**: User explicitly requested: "la idea es hacer todo eso desde glorian system para eso esta creado que mas podemos instalar para poder afrontar cualquier reto de cualquier empresa y cualquier sistema cualquiera de cualquier complejidad cualquiera", followed by approving `change134_toolchain_plan.md` and prompting "continua".
- **Squad**: `user:valentin-florez-arbelaez`
- **Component**: `eos-system-control-plane`

## 3. Strict Preconditions & Constraints

- **Law I & II**: Complete SDD formal package approved prior to any implementation code.
- **Law V**: Zero external runtime npm dependencies (`dependencies: {}`).
- **Safety Boundary**: Kubernetes operations must refuse any context that does not match `kind-*` by default.
- **Execution Limits**: Max line count <= 744 lines per module, cyclomatic complexity <= 15 per function.
- **Serverless Budget**: Vercel function count must remain exactly 12 (no additional serverless entrypoints).
