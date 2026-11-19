# SPEC-356: Self-Rebalancing Ephemeral Micro-Thread Work-Stealing Scheduler

## 1. Specification Metadata

- **Spec ID**: `SPEC-356`
- **Change ID**: `CHANGE-218`
- **Ladder Stage**: `LADDER-13`
- **Status**: `SPECIFICATION_APPROVED`
- **Authorized By**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 2. Functional Requirements (IEEE 830 EARS Standard)

- **FR-356-01 (Chase-Lev Work-Stealing Deque Architecture)**:
  - _Ubiquitous_: `EL SISTEMA DEBE asignar a cada hilo trabajador un deque local donde el hilo propietario inserta (push) y extrae (pop) tareas desde el fondo (bottom) en orden LIFO para maximizar la localidad de caché, mientras que otros hilos ladrones (thieves) roban tareas desde el tope (top) en orden FIFO mediante operaciones atómicas libres de bloqueos.`

- **FR-356-02 (Lock-Free Bottom Push & Dynamic Ring Expansion)**:
  - _Event-Driven_: `CUANDO el hilo propietario inserta una micro-tarea en el fondo de su deque local, EL SISTEMA DEBE almacenar la tarea en el índice bottom y publicar el nuevo puntero bottom de manera atómica sin interferir con ladrones concurrentes, expandiendo dinámicamente el buffer si la capacidad se satura.`

- **FR-356-03 (Lock-Free Bottom Pop with Conflict Resolution)**:
  - _Event-Driven_: `CUANDO el propietario intenta extraer una tarea del fondo del deque, EL SISTEMA DEBE decrementar bottom; si bottom == top, DEBE resolver la contención frente a ladrones concurrentes mediante una operación atómica Compare-And-Swap (CAS), garantizando que exactamente un participante obtenga la tarea.`

- **FR-356-04 (Randomized Victim Work-Stealing Algorithm)**:
  - _State-Driven_: `MIENTRAS el deque local de un hilo trabajador esté vacío, EL SISTEMA seleccionará pseudo-aleatoriamente un trabajador víctima (victim) y ejecutará un robo (steal) desde el tope de su deque, evitando sesgos de afinidad que sobrecarguen a un único núcleo.`

- **FR-356-05 (Starvation-Free Task Aging & Priority Balancing)**:
  - _Ubiquitous_: `EL SISTEMA DEBE envejecer las tareas que permanecen desatendidas tras N ciclos de robo, promoviendo su prioridad para asegurar que ninguna micro-tarea sufra inanición (*starvation-freedom*).`

- **FR-356-06 (Sub-Millisecond Multi-Task Batch Execution & Telemetry)**:
  - _State-Driven_: `MIENTRAS el scheduler procese lotes de micro-tareas de enjambres de agentes, EL SISTEMA calculará el throughput de tareas completadas por segundo, el ratio de robos exitosos (*steal success rate*) y el factor de equilibrio de carga entre trabajadores.`

- **FR-356-07 (Leslie Lamport TLA+ Model 99 Invariant & Formal Audit)**:
  - _Ubiquitous_: `EL SISTEMA DEBE verificar formalmente la ausencia de pérdidas de tareas y la preservación de consistencia de punteros mediante el Modelo TLA+ 99 (WorkStealingScheduler.tla), emitiendo un recibo firmado en docs/evidence/WORK_STEALING_SCHEDULER_RECEIPT.json con epistemicState PRODUCTION_READY_WITHIN_TESTED_SCOPE.`

---

## 3. BDD Acceptance Criteria (Gherkin Standard)

```gherkin
ESCENARIO: BDD-1915: Chase-Lev Deque Owner LIFO Operations
  DADO un deque Chase-Lev asignado a un hilo propietario
  CUANDO el propietario inserta secuencialmente las tareas T1, T2 y T3
  ENTONCES la primera tarea extraída mediante popBottom es T3 (orden LIFO)
  Y las siguientes extracciones devuelven T2 y T1 sucesivamente

ESCENARIO: BDD-1916: Lock-Free Top Stealing by Concurrent Thieves
  DADO un deque con tareas T1, T2, T3 poblado por el propietario
  CUANDO un hilo ladrón ejecuta stealTop concurrentemente
  ENTONCES el ladrón obtiene T1 (la tarea más antigua en orden FIFO)
  Y el propietario que extrae simultáneamente obtiene T3 sin corrupción de memoria

ESCENARIO: BDD-1917: Single-Item CAS Contention Resolution
  DADO un deque conteniendo exactamente un elemento T1 (bottom == top + 1)
  CUANDO el propietario ejecuta popBottom al mismo tiempo que un ladrón ejecuta stealTop
  ENTONCES exactamente uno de los dos participantes obtiene T1
  Y el otro participante recibe estado EMPTY sin que el elemento se duplique o se pierda

ESCENARIO: BDD-1918: Self-Rebalancing Work-Stealing Across Worker Pool
  DADO un grupo de 4 hilos trabajadores donde el trabajador W0 recibe 100 tareas y W1..W3 están ociosos
  CUANDO se inicia la ejecución del scheduler cooperativo
  ENTONCES los trabajadores ociosos roban tareas activamente de W0
  Y la carga total se distribuye entre los 4 trabajadores con éxito

ESCENARIO: BDD-1919: Starvation-Free Priority Promotion on Task Aging
  DADO un conjunto de tareas con prioridades mixtas
  CUANDO tareas de baja prioridad envejecen tras múltiples épocas sin ejecución
  ENTONCES el scheduler eleva su prioridad y las despacha garantizando progreso

ESCENARIO: BDD-1920: Multi-Core Micro-Thread Benchmark & Formal Audit Receipt
  DADO el motor EosWorkStealingSchedulerCore
  CUANDO se ejecuta la auditoría formal y el benchmark de 10,000 micro-tareas
  ENTONCES el throughput supera 500,000 tareas por segundo
  Y se emite el recibo formal WORK_STEALING_SCHEDULER_RECEIPT.json con veredicto CONFORMANT
```
