# SPEC-273: Toolchain Adapters, Kubernetes Security Policy & Cluster Safety Guard

## 1. Specification Metadata

- **Specification ID**: `SPEC-273`
- **Change ID**: `CHANGE-135`
- **Phase**: `Phase B (Operational Read-Only Adapters)`
- **Version**: `v75.0.0`
- **Status**: `APPROVED`
- **Governed Protocols**: BDD-1413 through BDD-1418

---

## 2. Formal Functional Requirements (EARS Syntax)

### FR-273-01: Trivy Vulnerability Inspection & SARIF Generation

- **Pattern**: _Event-Driven_
- **Statement**: CUANDO el sistema ejecuta un escaneo de seguridad mediante Trivy (`EosTrivyScannerAdapter.scanFilesystem`), EL SISTEMA ejecutará el binario `trivy` de forma no-shell con argumentos discretos, normalizará los hallazgos en formato estructurado, generará un reporte compatible con OASIS SARIF v2.1.0, y emitirá un recibo sellado en `docs/evidence/SECURITY_SCAN_RECEIPT.json`.

### FR-273-02: Fail-Closed Gate ante Vulnerabilidades Críticas

- **Pattern**: _Error / Unwanted Condition_
- **Statement**: SI el reporte de escaneo de Trivy contiene al menos una vulnerabilidad con severidad `CRITICAL` no mitigada, ENTONCES EL SISTEMA marcará el veredicto como `FAIL_CLOSED`, bloqueará la compuerta de aprobación de seguridad, e incluirá los identificadores CVE en el resumen de salida.

### FR-273-03: Evaluación Declarativa de Políticas OPA en Kubernetes

- **Pattern**: _Event-Driven_
- **Statement**: CUANDO el sistema evalúa manifiestos de Kubernetes contra políticas OPA Rego (`EosOpaPolicyGovernor.evaluateManifest`), EL SISTEMA verificará que las directivas de seguridad (`policies/k8s/security_baseline.rego`) requieran ejecución como no-root (`runAsNonRoot: true`), denieguen contenedores privilegiados (`privileged: true`), exijan límites explícitos de CPU y memoria (`resources.limits`), y prohíban etiquetas de imagen `:latest`.

### FR-273-04: Detección y Rechazo de Manifiestos No Conformes

- **Pattern**: _Error / Unwanted Condition_
- **Statement**: SI un manifiesto de Kubernetes viola una o más reglas Rego de la línea base de seguridad, ENTONCES EL SISTEMA retornará `allowed: false` con la lista explícita de violaciones desglosadas por contenedor y regla violada.

### FR-273-05: Inviolabilidad de Contexto en Inspección de Clúster Kubernetes

- **Pattern**: _Error / Unwanted Condition_
- **Statement**: SI el contexto actual de `kubectl` no coincide con el patrón permitido `kind-*` (y no existe override explícito en `EOS_K8S_ALLOWED_CONTEXTS`), ENTONCES EL SISTEMA abortará la inspección inmediatamente con veredicto `CONTEXT_UNAUTHORIZED`, impidiendo cualquier interacción involuntaria con clústeres de staging, nube o producción.

### FR-273-06: Telemetría de Clúster de Solo Lectura

- **Pattern**: _Event-Driven_
- **Statement**: CUANDO el sistema inspecciona un clúster local autorizado bajo contexto `kind-*`, EL SISTEMA ejecutará consultas `kubectl` de solo lectura (`get nodes -o json`, `get pods -A -o json`) con timeouts estrictos y devolverá un resumen consolidado de salud de nodos, capacidad de recursos, pods listos y pods fallidos.

---

## 3. BDD Acceptance Criteria

```gherkin
ESCENARIO: BDD-1413 - Trivy Filesystem Security Scanning & SARIF Export
  DADO un directorio de proyecto o fixture con manifiestos y dependencias
  CUANDO EosTrivyScannerAdapter ejecuta la inspección de vulnerabilidades
  ENTONCES genera un reporte estructurado con totalVulnerabilities y severidades
  Y exporta un objeto SARIF v2.1.0 válido con $schema y runs
  Y emite un recibo criptográfico SHA-256 de auditoría.

ESCENARIO: BDD-1414 - Fail-Closed Gate on CRITICAL Vulnerabilities
  DADO un reporte de Trivy que contiene una vulnerabilidad marcada como CRITICAL
  CUANDO EosTrivyScannerAdapter evalúa el umbral de aceptación
  ENTONCES el veredicto es FAIL_CLOSED
  Y la compuerta de seguridad prohíbe el paso
  Y los identificadores CVE críticos son reportados.

ESCENARIO: BDD-1415 - OPA Rego Policy Evaluation on Compliant Manifest
  DADO un manifiesto Kubernetes conforme con runAsNonRoot, non-privileged, límites de CPU/memoria y tag específico
  CUANDO EosOpaPolicyGovernor evalúa el manifiesto contra policies/k8s/security_baseline.rego
  ENTONCES allowed es true
  Y la lista de violaciones está vacía.

ESCENARIO: BDD-1416 - OPA Policy Enforcement Rejection on Flawed Manifest
  DADO un manifiesto Kubernetes que declara privileged=true y etiqueta :latest
  CUANDO EosOpaPolicyGovernor evalúa el manifiesto contra policies/k8s/security_baseline.rego
  ENTONCES allowed es false
  Y se reportan las violaciones de contenedor privilegiado e imagen no fijada.

ESCENARIO: BDD-1417 - Kubectl Context Guard Refuses Non-Kind Clusters
  DADO un entorno donde el contexto activo de kubectl es "arn:aws:eks:us-east-1:123456:cluster/prod"
  CUANDO EosKubectlClusterInspector intenta ejecutar una inspección
  ENTONCES la ejecución es rechazada con CONTEXT_UNAUTHORIZED
  Y ninguna consulta al clúster remoto es despachada.

ESCENARIO: BDD-1418 - Read-Only Cluster Status & Node/Pod Health Telemetry
  DADO un clúster local activo con contexto autorizado "kind-glorian-cluster"
  CUANDO EosKubectlClusterInspector consulta el estado del clúster
  ENTONCES devuelve el número total de nodos, estado Ready y pods activos
  Y emite el reporte estructurado sin mutar el clúster.
```
