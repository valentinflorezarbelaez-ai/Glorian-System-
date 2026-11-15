# SPEC-274: Kubernetes Gated Deployment Pipeline & k6 SLO Load Testing Engine

## 1. Specification Metadata

- **Specification ID**: `SPEC-274`
- **Component ID**: `eos-system-control-plane`
- **Lifecycle Stage**: `production`
- **Governed Change**: `CHANGE-136`
- **Architectural Regime**: Layer-0 Zero-Dependency Hexagonal
- **Scenarios Covered**: `BDD-1419` through `BDD-1424`

---

## 2. Requirements Engineering (EARS Standard)

### Functional Requirements

- **FR-274-01 (Ubiquitous - Deployment Guard)**: EL SISTEMA mantendrá una barrera estricta que prohíba todo despliegue (`kubectl apply`) en contextos que no coincidan con la expresión regular `/^kind-/`.
- **FR-274-02 (Event-Driven - Policy Gating)**: CUANDO se invoque un despliegue de manifiesto Kubernetes, EL SISTEMA ejecutará primero la validación de políticas OPA Rego y abortará de inmediato si se detecta cualquier infracción de seguridad.
- **FR-274-03 (Event-Driven - Server Dry Run)**: CUANDO el manifiesto cumpla las políticas OPA, EL SISTEMA ejecutará un `kubectl apply --dry-run=server` para validar la admisión del clúster antes de permitir el despliegue real.
- **FR-274-04 (Event-Driven - Explicit Apply Gate)**: SI no se proporciona confirmación explícita (`--yes` o `dryRun: false` confirmado), ENTONCES EL SISTEMA detendrá la ejecución tras el dry-run y reportará `DRY_RUN_PASSED`.
- **FR-274-05 (Event-Driven - k6 Execution)**: CUANDO se solicite un test de carga con k6, EL SISTEMA generará y ejecutará herméticamente un script k6 midiendo latencias P95, P99 y tasas de error HTTP.
- **FR-274-06 (State-Driven - SLO Threshold Evaluation)**: MIENTRAS la latencia observada o la tasa de fallos excedan los umbrales configurados, EL SISTEMA marcará el veredicto del test como `SLO_BREACHED` y bloqueará la compuerta.

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-1419 - Context Guard Blocks Deployment to External Clusters
  DADO un contexto de Kubernetes no autorizado (ej. "arn:aws:eks:...")
  CUANDO se invoca EosKubernetesDeployGovernor.deployWorkload
  ENTONCES la ejecución se bloquea inmediatamente con status "CONTEXT_UNAUTHORIZED"
  Y no se envía ninguna petición de escritura al clúster externo.

ESCENARIO: BDD-1420 - OPA Policy Violation Halts Deployment Pipeline
  DADO un manifiesto Kubernetes con violaciones de seguridad (ej. corre como root o usa etiqueta :latest)
  CUANDO se invoca EosKubernetesDeployGovernor.deployWorkload
  ENTONCES el pipeline se detiene en la fase de políticas con status "POLICY_VIOLATION"
  Y se enumeran todas las infracciones detectadas con su severidad.

ESCENARIO: BDD-1421 - Server Dry-Run Validation on Compliant Manifest
  DADO un manifiesto Kubernetes conforme a todas las políticas OPA
  CUANDO se invoca EosKubernetesDeployGovernor.deployWorkload en modo dry-run
  ENTONCES el servidor valida la admisión y retorna status "DRY_RUN_PASSED"
  Y se emite un recibo criptográfico SHA-256 de validación previa.

ESCENARIO: BDD-1422 - Successful Gated Workload Deployment on Kind Cluster
  DADO un manifiesto conforme y autorización explícita para aplicar en un clúster kind
  CUANDO se ejecuta el despliegue mediante EosKubernetesDeployGovernor.deployWorkload
  ENTONCES el manifiesto se aplica exitosamente reportando status "APPLIED"
  Y se genera un recibo de despliegue con timestamp y SHA-256.

ESCENARIO: BDD-1423 - k6 Load Test Execution and Telemetry Normalization
  DADO un endpoint objetivo y parámetros de carga (VUs, duración)
  CUANDO se ejecuta EosK6LoadTestAdapter.runLoadTest
  ENTONCES se capturan las métricas P95, P99, RPS y porcentaje de fallos
  Y se genera un recibo estructurado con status "PASS" si cumple los umbrales SLO.

ESCENARIO: BDD-1424 - k6 SLO Threshold Breach Gating
  DADO un umbral estricto de latencia P95 (ej. 10ms) que es superado durante la prueba
  CUANDO se evalúan las métricas de k6 mediante EosK6LoadTestAdapter
  ENTONCES el status es "SLO_BREACHED"
  Y la compuerta de carga reporta fallo para proteger la estabilidad del sistema.
```
