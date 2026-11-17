# SPEC-334: Deterministic Discrete-Event Simulation Hypervisor & Time-Travel Fault Injection Engine

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO se programa un nuevo evento discreto en el hipervisor de simulación, EL SISTEMA encola el evento en una cola de prioridad monótona ordenada estrictamente por tiempo virtual en nanosegundos, nivel de prioridad y número de secuencia determinista.
- **FR-2 (State-Driven)**: MIENTRAS el hipervisor avanza el tiempo virtual durante una ejecución o avance paso a paso, EL SISTEMA desacopla completamente el avance temporal del reloj físico del anfitrión (wall-clock time), garantizando que todos los generadores pseudoaleatorios deriven de una semilla de 64 bits fija con 100% de reproducibilidad bit a bit.
- **FR-3 (Event-Driven)**: CUANDO dos o más nodos o actores virtuales transmiten mensajes a través del bus del hipervisor, EL SISTEMA intercepta cada sobre de mensaje antes de su entrega para aplicar latencia virtual programada, encolado y comprobación de políticas de red.
- **FR-4 (Event-Driven)**: CUANDO se activa una regla de inyección de fallas bizantinas (pérdida de paquetes, corrupción de bytes, partición simétrica/asimétrica de red, salto de reloj o caída y reinicio de nodo), EL SISTEMA altera o descarta los eventos y mensajes afectados registrando la mutación en el registro determinista de fallas.
- **FR-5 (Event-Driven)**: CUANDO se invoca la captura de un punto de control (checkpoint) o la reversión temporal (time-travel rollback), EL SISTEMA congela o restaura el estado global completo (reloj virtual, semilla PRNG, cola de eventos, nodos y mensajes en tránsito) permitiendo la exploración de ramas de ejecución contrafácticas.
- **FR-6 (Ubiquitous / Permanent)**: EL SISTEMA evalúa invariantes declarativas de estado tras cada despacho de evento discreto y genera un recibo de auditoría sellado con SHA-256 que certifica la determinismo de la simulación, el número de pasos ejecutados y la ausencia de violaciones de invariantes.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1779 Avance Determinista de Reloj Virtual y Cola de Eventos de Precisión Nanosegundo
  DADO un hipervisor de simulación de eventos discretos inicializado con semilla fija
  CUANDO se programan múltiples eventos desordenados en el tiempo virtual
  ENTONCES el motor despacha los eventos en estricto orden cronológico monótono
  Y el reloj virtual avanza exactamente a la estampa de tiempo del evento procesado sin depender del reloj del anfitrión.

ESCENARIO: BDD-1780 Reproducibilidad Bit a Bit de Traectorias de Simulación mediante Semilla PRNG
  DADO un escenario de simulación distribuida con selección probabilística de rutas y latencias aleatorias
  CUANDO se ejecutan dos simulaciones independientes utilizando la misma semilla inicial de 64 bits
  ENTONCES ambas simulaciones producen exactamente la misma secuencia de estados, eventos despachados y huella de salida SHA-256.

ESCENARIO: BDD-1781 Intercepción de Mensajería y Virtualización de Nodos en Malla
  DADO una malla de nodos virtuales registrados en el hipervisor (coordinador, réplicas y clientes)
  CUANDO el nodo emisor despacha un mensaje hacia un nodo receptor con un retardo configurado de 50ms virtuales
  ENTONCES el hipervisor intercepta el sobre, programa la entrega en el instante virtual exacto
  Y entrega el mensaje al manejador del nodo receptor con integridad garantizada.

ESCENARIO: BDD-1782 Inyección Dinámica de Fallas Bizantinas (Partición de Red, Corrupción y Caída de Nodos)
  DADO un clúster virtual comunicándose a través del bus del hipervisor
  CUANDO se inyecta una partición de red que aísla un subconjunto de nodos y se programan pérdidas y corrupciones de paquetes
  ENTONCES los mensajes inter-partición son retenidos o descartados según la política
  Y el nodo bajo falla experimenta la mutación o caída sin afectar la estabilidad del hipervisor anfitrión.

ESCENARIO: BDD-1783 Puntos de Control Globales Chandy-Lamport y Reversión Temporal (Time-Travel Debugging)
  DADO una simulación que ha avanzado N pasos y capturado un punto de control en el paso K (K < N)
  CUANDO se ejecuta una reversión temporal hacia el punto de control del paso K
  ENTONCES el hipervisor restaura íntegramente el reloj virtual, los estados internos de los nodos, la cola de eventos y el registro PRNG
  Y permite reiniciar la ejecución bifurcando hacia una nueva trayectoria con parámetros alterados.

ESCENARIO: BDD-1784 Verificación Continua de Invariantes y Certificación Criptográfica de Ejecución
  DADO un conjunto de invariantes de seguridad y consistencia registradas en el hipervisor
  CUANDO concluye la corrida de simulación o se detecta una violación de invariantes
  ENTONCES el hipervisor verifica que virtualTimeMonotonicity es true, prngDeterminism es true y snapshotConsistency es true
  Y emite el recibo formal en docs/evidence/DESH_RECEIPT.json con el hash de auditoría de la corrida.
```
