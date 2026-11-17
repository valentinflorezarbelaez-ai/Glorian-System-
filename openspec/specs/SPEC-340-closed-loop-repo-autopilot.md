# SPEC-340: Sovereign Closed-Loop Repository Autopilot Engine

**Status**: `APPROVED`

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO se invoca `ingestRepositoryOntology` sobre un repositorio válido, EL SISTEMA lee `docs/projects/registry.json`, `docs/quality/mutation-budget.json` y `docs/evidence/TLC_RECEIPT.json` e ingesta proyectos de flota, módulos ratificados por mutación y modelos formales verificados dentro de `EosOntologicalHypergraphCore`, generando hiperaristas relacionales y un recibo bitemporal auditado.
- **FR-2 (Event-Driven)**: CUANDO se invoca `diagnoseCausalRootCause`, EL SISTEMA construye el grafo acíclico estructural de calidad (`TASK_COMPLEXITY`, `SPEC_CLARITY`, `CODE_CHURN`, `MUTATION_SCORE`, `PR_FIRST_PASS_YIELD`) en `EosCausalStructuralModelCore`, verifica la d-separación y el criterio de puerta trasera (_Backdoor Criterion_), cuantifica el efecto causal intervencional $\text{do}(\text{SPEC\_CLARITY})$ y calcula la inferencia contrafáctica en 3 pasos.
- **FR-3 (Event-Driven)**: CUANDO se ejecuta `simulateRemediationPreFlight`, EL SISTEMA programa eventos discretos entre nodos virtuales en `EosDiscreteEventSimulationHypervisorCore`, captura un checkpoint global Chandy-Lamport, inyecta un fallo transitorio controlado, realiza _rollback_ determinista y reproduce la simulación con cero violaciones de invariantes.
- **FR-4 (Event-Driven)**: CUANDO se invoca `evaluateLiveGitHarnessTelemetry`, EL SISTEMA clasifica el historial reciente de commits Git (`feat`/`fix`/`docs`, o un conjunto canónico determinista ante ausencia de Git), calcula `firstPassYieldRatio` y `meanReworkAmplificationFactor` mediante `EosAgenticHarnessYieldCore` y ejecuta el bucle de validación de 5 etapas.
- **FR-5 (Error / Unwanted Condition)**: SI el directorio raíz del proyecto no existe o algún parámetro de entrada (`commitLimit <= 0`, datos sintéticos corruptos o falta de un nodo requerido) incumple el contrato del bucle cerrado, ENTONCES EL SISTEMA detiene la ejecución de forma fail-closed lanzando `AutopilotError` con el código correspondiente (`AUTOPILOT_INVALID_ROOT`, `AUTOPILOT_INVALID_PARAMETERS`, `AUTOPILOT_STAGE_VIOLATION`).
- **FR-6 (Ubiquitous)**: EL SISTEMA expone `runClosedLoopAutopilot()` y `audit()`, ejecutando las 4 etapas secuencialmente sobre estado real del repositorio y emitiendo un recibo criptográfico firmado con SHA-256 en `docs/evidence/CLOSED_LOOP_AUTOPILOT_RECEIPT.json` (cuando se invoca por CLI).

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1815 Ingesta Ontológica Bitemporal de Artefactos Reales del Repositorio
  DADO una instancia de EosClosedLoopRepoAutopilotCore apuntando al directorio raíz del repositorio
  CUANDO se ejecuta ingestRepositoryOntology()
  ENTONCES se registran proyectos de registry.json, módulos de mutation-budget.json y modelos de TLC_RECEIPT.json en el hipergrafo ontológico
  Y la auditoría del hipergrafo reporta bitemporalMonotonicity, referentialIntegrity, mlsLatticeContainment y deduplicationResolved en true.

ESCENARIO: BDD-1816 Diagnóstico Causal Estructural (SCM) y Contrafáctico sobre Calidad de PR
  DADO el modelo estructural de calidad construido sobre la señal de ontología ingresada
  CUANDO se ejecuta diagnoseCausalRootCause()
  ENTONCES backdoorValid es true, interventionalAte > 0 para do(SPEC_CLARITY) y la predicción contrafáctica mejora el rendimiento esperado de PR
  Y la auditoría SCM interna retorna allPassed === true.

ESCENARIO: BDD-1817 Pre-Flight DESH Determinista con Checkpoint Chandy-Lamport y Rollback
  DADO la semilla determinista y los parámetros de simulación del bucle cerrado
  CUANDO se ejecuta simulateRemediationPreFlight()
  ENTONCES se captura el checkpoint global, la inyección transitoria es aislada, rollbackSucceeded es true
  Y la repetición tras rollback finaliza con snapshotConsistency === true y violationsCount === 0.

ESCENARIO: BDD-1818 Telemetría Viva de Arnés Agéntico y Git FPY / RAF
  DADO el historial reciente de commits Git del repositorio (o fallback determinista)
  CUANDO se ejecuta evaluateLiveGitHarnessTelemetry()
  ENTONCES evalúa la cohorte de PRs con firstPassYieldRatio en [0, 1] y meanReworkAmplificationFactor >= 1
  Y ejecuta exitosamente el bucle de arnés de 5 etapas con prReady === true.

ESCENARIO: BDD-1819 Ejecución Integral en Bucle Cerrado y Validación Fail-Closed de Fronteras
  DADO una ruta inexistente o commitLimit inválido (<= 0)
  CUANDO se construye o invoca EosClosedLoopRepoAutopilotCore
  ENTONCES el sistema falla de forma fail-closed con AUTOPILOT_INVALID_ROOT o AUTOPILOT_INVALID_PARAMETERS.

ESCENARIO: BDD-1820 Auditoría Integral y Recibo Criptográfico SHA-256
  DADO el bucle cerrado completo runClosedLoopAutopilot() / audit()
  CUANDO se completan todas las etapas (INGESTION -> CAUSAL -> DESH -> HARNESS)
  ENTONCES allPassed es true, stageOrderPreserved es true y se genera un sha256Digest determinista de 64 caracteres hexadecimales.
```
