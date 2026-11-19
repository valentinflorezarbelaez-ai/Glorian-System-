# SPEC-366: SWE-Bench Autonomous Evaluation Harness & Fleet Eval Flywheel

**Specification ID**: `SPEC-366`  
**Change Reference**: `CHANGE-228`  
**Lifecycle Tier**: `production`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Formal TLA+ Model**: `docs/formal/SweBenchEvalFlywheel.tla` (Model 109)  
**Status**: `APPROVED`

---

## 1. Scope & Domain Context

This specification formally establishes the requirements, interfaces, state invariants, and verification criteria for `EosSweBenchEvalFlywheel`. The engine delivers a hermetic autonomous software engineering evaluation platform. It executes coding challenges under SWE-bench verified semantics, mines in-house evaluation challenges from git commits across the 9 registered fleet repositories, calculates deterministic pass@1 and pass@k scores, and certifies agentic problem-solving capabilities quantitatively.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-366-01 (Ubiquitous Hermetic Evaluation Execution)**:
  `EL SISTEMA DEBE ejecutar baterías de desafíos de ingeniería de software en entornos aislados de prueba (worktrees/sandboxes temporales) sin mutar el workspace principal ni propagar efectos secundarios fuera de la celda de evaluación.`

- **FR-366-02 (Event-Driven Task Staging & Pre-Patch Initialization)**:
  `CUANDO se despacha un desafío de evaluación ('EVAL_TASK'), EL SISTEMA DEBE clonar el estado del repositorio base, aplicar el diff de prueba oculta ('fail_to_pass' oracle) y suministrar el contexto del problema al agente sujeto de prueba.`

- **FR-366-03 (State-Driven Synthetic Git PR Challenge Mining)**:
  `MIENTRAS se examine el historial de commits y PRs de los 9 repositorios registrados, EL SISTEMA DEBE extraer automáticamente pares de evaluación compuestos por (descripción del problema, código pre-fix, diff de resolución esperado y pruebas de verificación).`

- **FR-366-04 (Event-Driven Oracle Test Evaluation & Grading)**:
  `CUANDO el agente genera y aplica un parche candidato, EL SISTEMA DEBE ejecutar la suite de pruebas del oráculo, evaluar el código de salida y clasificar el resultado estrictamente como 'RESOLVED', 'FAILED', 'ERROR' o 'TIMEOUT'.`

- **FR-366-05 (Ubiquitous Statistical pass@k Metric Computation)**:
  `EL SISTEMA DEBE calcular con rigor estadístico los estimadores pass@k (k en {1, 3, 5}), la tasa de éxito de resolución, el tiempo medio de convergencia y el gasto de tokens por tarea resuelta.`

- **FR-366-06 (State-Driven Fleet Benchmark Flywheel Matrix)**:
  `MIENTRAS se evalúe la flota completa, EL SISTEMA DEBE correlacionar el desempeño del agente en los 9 repositorios registrados (aberamentho, atp-strength, biblioteca-gnostica-1, control-de-asistencia-abopack, crud-slack, donaciones, eos-system, performance-talent-group, portafolio), emitiendo una matriz comparativa multidimensional.`

- **FR-366-07 (Error / Unwanted Condition Sandbox Circuit Breaking)**:
  `SI un intento de resolución excede el límite de tiempo asignado (TTL > 120000ms) o genera consumo excesivo de memoria/recursos, ENTONCES EL SISTEMA DEBE terminar inmediatamente el proceso del sandbox, registrar 'TIMEOUT_EXCEEDED' y restaurar el estado limpio del entorno.`

---

## 3. Acceptance Criteria (BDD Syntax)

### BDD-1975: Evaluation Task Staging & Pre-Condition Sandboxing

```gherkin
ESCENARIO: Preparación hermética de una tarea de evaluación SWE-Bench
  DADO una especificación de desafío de evaluación SWE-Bench válida
  CUANDO el motor de evaluación inicializa el entorno de prueba
  ENTONCES crea un sandbox hermético temporal con el código base pre-patch
  Y valida que las pruebas de oráculo fallan en el estado inicial ('PRE_PATCH_FAIL').
```

### BDD-1976: Candidate Patch Application & Oracle Grading

```gherkin
ESCENARIO: Aplicación de parche generado y evaluación con pruebas de oráculo
  DADO un sandbox inicializado con el fallo base
  CUANDO el agente suministra un diff de parche candidato válido
  ENTONCES el motor aplica el parche limpiamente sin conflictos
  Y ejecuta las pruebas de oráculo reportando estado 'RESOLVED' con código de salida 0.
```

### BDD-1977: Synthetic Eval Mining from Fleet Git Repositories

```gherkin
ESCENARIO: Minería automática de desafíos sintéticos a partir de commits reales
  DADO un repositorio registrado de la flota con historial de commits de corrección
  CUANDO el minero sintético analiza los diffs de cambios y pruebas
  ENTONCES sintetiza un desafío formal de evaluación ('SyntheticEvalChallenge')
  Y valida la existencia de la prueba oculta de oráculo y la descripción del problema.
```

### BDD-1978: Statistical pass@k & Cost Scorecard Calculation

```gherkin
ESCENARIO: Cálculo cuantitativo de pass@1, pass@3 y presupuesto de resolución
  DADO una batería de 10 desafíos ejecutados con múltiples muestras candidatas
  CUANDO se calculan los estimadores de pass@k
  ENTONCES emite los valores de pass@1 y pass@3 con 100% de consistencia matemática
  Y registra el tiempo medio de resolución y la métrica de parches mínimos.
```

### BDD-1979: Timeout and Resource Circuit Breaker Enforcement

```gherkin
ESCENARIO: Interrupción forzada por exceso de tiempo de ejecución en sandbox
  DADO un agente ejecutando una tarea con bucle infinito o estancamiento
  CUANDO la ejecución excede la ventana de TTL configurada
  ENTONCES el motor aborta el proceso hijo con señal de terminación forzada
  Y clasifica la tarea con estado 'TIMEOUT' sin corromper el entorno de pruebas.
```

### BDD-1980: Full Diagnostic Audit & Eval Flywheel Receipt

```gherkin
ESCENARIO: Auditoría integral del harness de evaluación y recibo criptográfico
  DADO el motor EosSweBenchEvalFlywheel en ejecución nominal
  CUANDO se ejecuta la auditoría diagnóstica completa
  ENTONCES todas las comprobaciones (Sandboxing, Oracle Grading, Mining, pass@k, Circuit Breaker) resultan 'PASS'
  Y emite un recibo criptográfico firmado SHA-256 vinculando SPEC-366 y CHANGE-228.
```
