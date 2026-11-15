# SPEC-285: Distributed Deadlock Detection & Wait-For Graph (WFG) Cycle Governor

- **Status**: APPROVED
- **Change Reference**: `CHANGE-147`
- **Intake Reference**: `INTAKE-147`
- **Domain**: Transaction Concurrency Control, Wait-For Graph Analysis & Deadlock Prevention
- **Date**: 2026-11-15

---

## 1. Functional Requirements (IEEE 830 / EARS)

### FR-285-01: Wait-For Graph (WFG) Model Construction

- **Event-Driven**: CUANDO se ingresa un conjunto de transacciones activas con bloqueos adquiridos y solicitudes de bloqueo pendientes, EL SISTEMA construirá un grafo dirigido $G = (V, E)$ mapeando aristas $(T_i \rightarrow T_j)$ donde $T_i$ espera por un recurso retenido por $T_j$.

### FR-285-02: Elementary Cycle Detection ($O(V + E)$)

- **Ubiquitous / Permanent**: EL SISTEMA detectará recursivamente todos los ciclos dirigidos en el grafo WFG, identificando las secuencias cerradas de dependencias que constituyen situaciones de interbloqueo (_deadlock_).

### FR-285-03: Deterministic Victim Transaction Selection

- **State-Driven**: MIENTRAS se detecta uno o más ciclos en el grafo WFG, EL SISTEMA seleccionará una transacción víctima por cada ciclo (priorizando la transacción más joven o con menor costo de reversión) para abortarla y romper el ciclo.

### FR-285-04: Wound-Wait Deadlock Prevention Evaluation

- **Event-Driven**: CUANDO una transacción $T_i$ solicita un recurso retenido por $T_j$, si el modo Wound-Wait está activo y $T_i$ es más antigua que $T_j$ ($t_i < t_j$), EL SISTEMA emitirá una directiva `WOUND` preemptiva abortando $T_j$; si $T_i$ es más joven, emitirá directiva `WAIT`.

### FR-285-05: Wait-Die Deadlock Prevention Evaluation

- **Event-Driven**: CUANDO una transacción $T_i$ solicita un recurso retenido por $T_j$, si el modo Wait-Die está activo y $T_i$ es más antigua que $T_j$ ($t_i < t_j$), EL SISTEMA emitirá directiva `WAIT`; si $T_i$ es más joven, emitirá directiva `DIE` abortando $T_i$ inmediatamente.

### FR-285-06: Verifiable Deadlock Audit Receipt

- **Ubiquitous / Permanent**: EL SISTEMA emitirá un manifiesto criptográfico de auditoría en `docs/evidence/DEADLOCK_RECEIPT.json` con conteo de transacciones, ciclos detectados, víctimas seleccionadas y firma digital SHA-256.

---

## 2. BDD Acceptance Criteria

```gherkin
ESCENARIO: BDD-1485 Wait-For Graph Construction from Transaction Events
  DADO un conjunto de 3 transacciones activas con asignaciones y esperas de recursos
  CUANDO EosDeadlockDetectionGovernor.buildWfg es invocado
  ENTONCES construye un grafo dirigido con vértices y aristas que reflejan exactamente las dependencias de bloqueo.

ESCENARIO: BDD-1486 Elementary Cycle Detection in Cyclic Dependency Graph
  DADO un grafo WFG conteniendo un ciclo circular T1 -> T2 -> T3 -> T1
  CUANDO EosDeadlockDetectionGovernor.detectDeadlocks es ejecutado
  ENTONCES retorna hasDeadlock: true identificando la lista exacta de transacciones en el ciclo.

ESCENARIO: BDD-1487 Acyclic Dependency Graph Validation
  DADO un grafo WFG en cascada lineal T1 -> T2 -> T3 sin dependencias circulares
  CUANDO detectDeadlocks es invocado
  ENTONCES retorna hasDeadlock: false con lista de ciclos vacía y cero víctimas seleccionadas.

ESCENARIO: BDD-1488 Deterministic Victim Selection and Cycle Resolution
  DADO un ciclo de interbloqueo detectado entre T1 (timestamp=100) y T2 (timestamp=200)
  CUANDO resolveDeadlock es invocado
  ENTONCES selecciona a T2 (la transacción más joven) como víctima para aborto
  Y la eliminación de la víctima disuelve el ciclo en el grafo resultante.

ESCENARIO: BDD-1489 Wound-Wait Protocol Conflict Resolution
  DADO una transacción antigua T_old (timestamp=100) solicitando un recurso de T_young (timestamp=200)
  CUANDO evaluateWoundWait es ejecutado
  ENTONCES emite directiva WOUND para preemptar a T_young
  Y en caso inverso donde T_young solicita a T_old, emite directiva WAIT.

ESCENARIO: BDD-1490 Deadlock Audit Evidence Receipt Emission
  DADO una auditoría de interbloqueos completada
  CUANDO generateReceipt es ejecutado
  ENTONCES emite docs/evidence/DEADLOCK_RECEIPT.json con firma digital SHA-256 verificable.
```
