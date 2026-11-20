# SPEC-368: Adversarial Red-Team Crucible & Minimax Exploit-Patch Game

**Document ID**: `SPEC-368-adversarial-red-team-crucible`  
**Change Target**: `CHANGE-230`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Lifecycle Tier**: `production`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Date**: `2026-11-19`

---

## 1. Functional Requirements (EARS Standard)

- **FR-368-01 (Attack Generation)**:  
  `CUANDO` se inicia una ronda adversarial, `EL SISTEMA` generará vectores de ataque estructurados mutando cargas útiles, comandos o prompts contra la superficie objetivo según la taxonomía de ataque seleccionada (PROMPT_INJECTION, INVARIANT_VIOLATION, PATHOLOGICAL_PAYLOAD, RACE_CONDITION).

- **FR-368-02 (Exploit Evaluation)**:  
  `CUANDO` un vector de ataque es evaluado contra el objetivo actual, `EL SISTEMA` ejecutará la carga en un arnés aislado determinista y clasificará el resultado como PENETRATED si se viola un invariante o se expone información no autorizada, o DEFENDED en caso contrario.

- **FR-368-03 (Counterexample Extraction)**:  
  `SI` un vector de ataque penetra la defensa actual, `ENTONCES EL SISTEMA` capturará el contraejemplo completo (payload, traza, estado previo, estado posterior) y lo registrará en el almacén de contraejemplos CEGIS.

- **FR-368-04 (Defensive Patch Synthesis)**:  
  `CUANDO` se detectan contraejemplos pendientes, `EL SISTEMA` sintetizará parches defensivos (guardas de validación, filtros de sanitización o invariantes de estado) que neutralicen el contraejemplo sin quebrar las pruebas de regresión base.

- **FR-368-05 (Minimax Tournament Loop)**:  
  `MIENTRAS` el torneo adversarial esté activo y no se alcance el umbral de parada (convergencia $\epsilon$ o presupuesto de rondas), `EL SISTEMA` alternará turnos entre Red-Team (maximizador de exploits) y Blue-Team (minimizador de brechas).

- **FR-368-06 (Equilibrium & Scorecard Calculation)**:  
  `CUANDO` concluye el torneo o se solicita una auditoría, `EL SISTEMA` calculará métricas de equilibrio minimax (tasa de penetración, tasa de neutralización, costo computacional y puntuación de robustez general).

- **FR-368-07 (Cryptographic Receipt & Audit)**:  
  `EL SISTEMA` emitirá un recibo criptográfico SHA-256 inmutable sellando el historial completo de rondas, ataques, parches y estado final del torneo.

---

## 2. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-1987 - Generation of Structured Adversarial Attack Vectors
  DADO un objetivo de prueba y una taxonomía de ataque definida
  CUANDO el Red-Team genera un lote de vectores adversarios
  ENTONCES cada vector contiene un identificador único, vector type, payload mutado y firma criptográfica
  Y ningún vector contiene estructuras malformadas no parseables.

ESCENARIO: BDD-1988 - Isolated Evaluation of Attack Payloads against Target
  DADO un vector de ataque y un objetivo con una postura defensiva inicial
  CUANDO el arnés evalúa el vector en el entorno aislado
  ENTONCES el resultado clasifica determinísticamente la ejecución como PENETRATED o DEFENDED
  Y se registra el tiempo de ejecución y la verificación de invariantes.

ESCENARIO: BDD-1989 - Counterexample Capture and CEGIS Store Ingestion
  DADO un ataque que penetra la superficie del objetivo
  CUANDO el evaluador detecta la violación de invariante
  ENTONCES el contraejemplo se ingesta en el almacén CEGIS con estado previo, traza y carga ofensiva
  Y queda disponible para la fase de síntesis defensiva.

ESCENARIO: BDD-1990 - Automated Defensive Patch Synthesis against Counterexamples
  DADO un contraejemplo registrado en el almacén CEGIS
  CUANDO el Blue-Team sintetiza una regla o guarda defensiva
  ENTONCES la nueva postura defensiva bloquea exitosamente el contraejemplo
  Y las pruebas funcionales de regresión base se preservan sin fallas.

ESCENARIO: BDD-1991 - Minimax Tournament Convergence and Metric Computation
  DADO un torneo con presupuesto de rondas y umbral de convergencia
  CUANDO se ejecutan rondas alternadas entre Red-Team y Blue-Team
  ENTONCES el torneo converge cuando la tasa de éxito defensivo supera el 95% o se agota el presupuesto
  Y se computa la matriz de pagos y la puntuación de robustez final.

ESCENARIO: BDD-1992 - Full Diagnostic Audit and Adversarial Crucible Receipt
  DADO un torneo o ciclo de pruebas completado
  CUANDO se invoca la auditoría del crisol adversarial
  ENTONCES se emite un recibo SHA-256 inmutable con el historial de rondas y métricas de convergencia
  Y el reporte cumple con los estándares del plano de control de Glorian.
```
