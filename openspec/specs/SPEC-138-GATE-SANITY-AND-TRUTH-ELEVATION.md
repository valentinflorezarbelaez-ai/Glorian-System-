# SPEC-138: SARIF Diagnostic Accumulation, Universal Secret Gate & Strict CI Unification

## 1. Specification Metadata
- **Specification ID**: `SPEC-138`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Related Specs**: `SPEC-096`, `SPEC-123`, `SPEC-124`, `SPEC-137`
- **Module Target**: `scripts/verify-cicd-pipeline.mjs`, `scripts/eos-github-pr-attestation.mjs`, `.github/workflows/`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-01 (Event-Driven / Error Handling)**:
  `CUANDO cualquiera de las etapas de verificación detecte una violación o lance una excepción, EL SISTEMA capturará el diagnóstico, lo agregará a la lista de findings y generará el reporte SARIF v2.1.0 antes de terminar con código de salida 1.`

- **FR-02 (Ubiquitous / Permanent)**:
  `EL SISTEMA mantendrá un único escritor canónico de SARIF en docs/evidence/local-checks.sarif, asegurando que results contenga los hallazgos reales detectados en lugar de un arreglo vacío estático.`

- **FR-03 (State-Driven / Strict EARS Gate)**:
  `MIENTRAS se evalúe la conformidad de especificaciones en openspec/specs/, EL SISTEMA exigirá que compliantSpecs sea estrictamente igual a specFiles.length, abortando el gate si alguna especificación carece de sintaxis EARS o escenarios BDD.`

- **FR-04 (Ubiquitous / Universal Secret Scan)**:
  `EL SISTEMA ejecutará el escaneo canónico de secretos sobre la totalidad del árbol de archivos (970+ archivos), prohibiendo filtros que limiten el escaneo a un subconjunto arbitrario de archivos.`

- **FR-05 (Event-Driven / Workflow Consolidation)**:
  `CUANDO se reciba un evento push o pull_request en GitHub Actions, EL SISTEMA ejecutará un único workflow consolidado dotado de cancelación de ejecuciones redundantes (concurrency), límite de tiempo de 10 minutos y acciones fijadas por SHA-256.`

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-366 Acumulación y Emisión Ineludible de SARIF ante Fallos
  DADO el ejecutor del pipeline de verificación scripts/verify-cicd-pipeline.mjs
  CUANDO se detectan fallos o violaciones durante cualquiera de las 7 etapas
  ENTONCES el script captura los hallazgos en un acumulador estructurado
  Y el archivo docs/evidence/local-checks.sarif se escribe siempre dentro de un bloque finally
  Y el arreglo results del SARIF refleja fielmente los hallazgos producidos
  Y el proceso finaliza con código de salida 1

ESCENARIO: BDD-367 Bloqueo Estricto por Especificación No Conforme
  DADO el verificador scripts/eos-github-pr-attestation.mjs
  CUANDO evalúa los archivos en openspec/specs/
  ENTONCES verifica que cada archivo contenga patrones válidos EARS y BDD
  Y exige que compliantSpecs sea idéntico al total de especificaciones
  Y rechaza la atestación si existe discrepancia

ESCENARIO: BDD-368 Unificación Soberana de CI en GitHub Actions
  DADO el directorio .github/workflows/
  CUANDO se inspeccionan las compuertas de integración continua
  ENTONCES existe un flujo de trabajo centralizado con cancelación de ejecuciones obsoletas
  Y todas las acciones externas se encuentran fijadas por hash SHA-256 completo
  Y no existen flujos redundantes compitiendo por los mismos eventos
```

---

## 4. Invariants & Non-Functional Requirements
- **NFR-01 (Zero Runtime Dependencies)**: Preserved 100%. No new external npm runtime dependencies.
- **NFR-02 (Fail-Closed Architecture)**: Default state is failure unless proven compliant.
- **NFR-03 (Deterministic Output)**: SARIF and Receipts must have zero machine-dependent timestamps in deterministic digests.
