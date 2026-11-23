# SPEC-275: Helm Packaging & Release Governor

**Status**: `APPROVED`

## 1. Specification Metadata

- **Specification ID**: `SPEC-275`
- **Component ID**: `eos-system-control-plane`
- **Lifecycle Stage**: `production`
- **Governed Change**: `CHANGE-137`
- **Architectural Regime**: Layer-0 Zero-Dependency Hexagonal
- **Scenarios Covered**: `BDD-1425` through `BDD-1430`

---

## 2. Requirements Engineering (EARS Standard)

### Functional Requirements

- **FR-275-01 (Ubiquitous - Chart Linting)**: EL SISTEMA mantendrá una función de auditoría que ejecute `helm lint` con validación estricta sobre la estructura, dependencias y valores del chart.
- **FR-275-02 (Event-Driven - In-Memory Template Rendering)**: CUANDO se solicite la evaluación o despliegue de un chart, EL SISTEMA ejecutará `helm template` para materializar los manifiestos YAML en memoria sin mutar el árbol de trabajo.
- **FR-275-03 (State-Driven - OPA Security Enforcement)**: MIENTRAS los manifiestos renderizados contengan recursos que violen las políticas OPA Rego v1 (`security_baseline.rego`), EL SISTEMA detendrá el pipeline con status `POLICY_VIOLATION`.
- **FR-275-04 (Event-Driven - Context Isolation Barrier)**: CUANDO se intente un despliegue mediante Helm, EL SISTEMA verificará que el contexto activo de Kubernetes coincida estrictamente con `/^kind-/`, bloqueando cualquier contexto externo con `CONTEXT_UNAUTHORIZED`.
- **FR-275-05 (Event-Driven - Server Dry-Run Admission)**: CUANDO el chart cumpla con las políticas OPA y el contexto sea válido, EL SISTEMA ejecutará `helm upgrade --install --dry-run=server` para verificar la admisión del API server antes del despliegue definitivo.
- **FR-275-06 (Event-Driven - Explicit Authorized Deployment)**: SI se proporciona autorización explícita (`--yes`), ENTONCES EL SISTEMA ejecutará `helm upgrade --install` en el clúster kind y emitirá un recibo criptográfico SHA-256 (`docs/evidence/HELM_RECEIPT.json`).

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-1425 - Helm Lint Validates Compliant Chart Structure
  DADO un Helm chart válido y bien estructurado
  CUANDO se invoca EosHelmReleaseGovernor.lintChart
  ENTONCES la ejecución retorna status "PASS" con cero errores sintácticos
  Y se reporta la latencia de análisis en milisegundos.

ESCENARIO: BDD-1426 - Helm Template Materializes In-Memory YAML Manifests
  DADO un Helm chart y un conjunto de valores
  CUANDO se invoca EosHelmReleaseGovernor.templateChart
  ENTONCES se genera una cadena YAML con todos los recursos Kubernetes renderizados
  Y no se escriben artefactos intermedios en el disco.

ESCENARIO: BDD-1427 - OPA Policy Audit Rejects Insecure Helm Chart Manifests
  DADO un Helm chart que renderiza contenedores sin securityContext o corriendo como root
  CUANDO se evalúa mediante EosHelmReleaseGovernor.auditChartWithOpa
  ENTONCES la auditoría falla con status "POLICY_VIOLATION"
  Y se enumeran las infracciones de seguridad detectadas.

ESCENARIO: BDD-1428 - Context Guard Blocks Helm Deployment to Unauthorized Clusters
  DADO un contexto Kubernetes no autorizado (ej. "prod-cluster-aws")
  CUANDO se invoca EosHelmReleaseGovernor.deployChart
  ENTONCES el despliegue se aborta inmediatamente con status "CONTEXT_UNAUTHORIZED"
  Y ninguna petición llega al servidor de la nube.

ESCENARIO: BDD-1429 - Server Dry-Run Validates Helm Chart Admission
  DADO un Helm chart conforme a las políticas OPA y un clúster kind activo
  CUANDO se ejecuta EosHelmReleaseGovernor.deployChart en modo dry-run
  ENTONCES se valida la admisión en el API server de Kubernetes y retorna status "DRY_RUN_PASSED"
  Y se emite un recibo criptográfico de validación.

ESCENARIO: BDD-1430 - Atomic Gated Helm Deployment to Kind Cluster
  DADO un Helm chart conforme y confirmación explícita (--yes)
  CUANDO se invoca EosHelmReleaseGovernor.deployChart
  ENTONCES el release de Helm se instala o actualiza exitosamente con status "RELEASE_DEPLOYED"
  Y se genera el recibo docs/evidence/HELM_RECEIPT.json con hash SHA-256 inmutable.
```
