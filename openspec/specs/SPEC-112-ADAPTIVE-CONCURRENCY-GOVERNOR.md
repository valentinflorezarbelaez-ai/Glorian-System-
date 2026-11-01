# SPEC-112: Distributed Adaptive Concurrency Control & Priority-Tier Load Shedding

## 1. Overview & Objective
This specification establishes the architectural standard for autonomous self-tuning concurrency control and priority-tier load shedding across the EOS fleet. Implementing the Netflix Vegas / Little's Law congestion gradient and CoDel queue delay management doctrines, this governor eliminates manual thread pool tuning, prevents bufferbloat collapses, and preserves critical business operations during severe system degradation.

---

## 2. Functional Requirements (IEEE 830 / Formal EARS)

### FR-301: Baseline Minimum RTT Tracking & Gradient Calculation
* **Ubiquitous**: EL SISTEMA medirá de forma continua la latencia de ida y vuelta ($RTT$) de cada solicitud completada, manteniendo una ventana deslizante del tiempo mínimo observado ($RTT_{\text{baseline}}$) y un promedio móvil ponderado exponencialmente ($RTT_{\text{current}}$).
* **State-Driven**: MIENTRAS el sistema reciba telemetría de ejecución, EL SISTEMA calculará el gradiente de congestión:
  $$\text{Gradient} = \frac{RTT_{\text{baseline}}}{RTT_{\text{current}}}$$

### FR-302: Dynamic Concurrency Limit Adjustment (Vegas Gradient)
* **Ubiquitous**: EL SISTEMA recalculará periódicamente el límite máximo de solicitudes en vuelo concurrentes ($\text{Limit}$) aplicando el gradiente de congestión con una holgura aditiva de cola ($\beta$):
  $$\text{Limit}_{t+1} = \text{clamp}(\text{MinLimit}, \text{MaxLimit}, \text{round}(\text{Limit}_t \times \text{Gradient} + \beta))$$
* **State-Driven**: MIENTRAS la latencia aumente ($RTT_{\text{current}} > RTT_{\text{baseline}}$), el gradiente se reducirá por debajo de $1.0$, provocando la contracción inmediata y preventiva del límite de concurrencia antes de la aparición de errores 5xx.

### FR-303: Multi-Tier Priority Admission & Load Shedding
* **Event-Driven**: CUANDO una solicitud arribe y el número de operaciones en vuelo alcance el límite de concurrencia actual ($\text{InFlight} \ge \text{Limit}$), EL SISTEMA evaluará el nivel de prioridad de la solicitud (`CRITICAL`, `HIGH`, `NORMAL`, `BEST_EFFORT`):
  * Solicitudes `BEST_EFFORT` serán descartadas de forma inmediata (`DROPPED_CONCURRENCY_SHED`).
  * Solicitudes `NORMAL` serán descartadas si $\text{InFlight} \ge \text{Limit} \times 0.90$.
  * Solicitudes `HIGH` serán descartadas únicamente si $\text{InFlight} \ge \text{Limit}$.
  * Solicitudes `CRITICAL` contarán con una reserva dedicada de capacidad de emergencia ($+\text{EmergencyHeadroom}$), garantizando su admisión ininterrumpida.

### FR-304: Queue Delay Bounding & Bufferbloat Prevention (CoDel)
* **Error / Unwanted Condition**: SI una solicitud encolada en espera de ejecución permanece en la cola por un tiempo superior al umbral máximo de permanencia ($\Delta t_{\text{queue}} > \text{MaxQueueDelayMs}$, por defecto 15ms), ENTONCES EL SISTEMA descartará la solicitud de inmediato con un error `QUEUE_TIMEOUT_EXCEEDED` sin ejecutar su lógica, evitando la saturación por solicitudes cuyo plazo útil ha expirado.

---

## 3. Acceptance Criteria (BDD / Gherkin)

```gherkin
ESCENARIO: BDD-288 Contracción Dinámica por Gradiente de Latencia y Expansión en Recuperación
  DADO un gobernador configurado con límite inicial de 50 peticiones y RTT base de 20ms
  CUANDO la latencia observada se cuadruplica a 80ms debido a congestión downstream
  ENTONCES el gobernador calcula un gradiente de 0.25 (20ms / 80ms)
  Y contrae el límite de concurrencia hacia el mínimo de seguridad de forma asintótica
  Y cuando la latencia retorna a 20ms, el gradiente sube a 1.0 y expande suavemente el límite

ESCENARIO: BDD-289 Descarte Gradual por Niveles de Prioridad ante Contracción de Capacidad
  DADO un gobernador con el límite de concurrencia saturado al 100%
  CUANDO se presentan solicitudes concurrentes de nivel BEST_EFFORT, NORMAL, HIGH y CRITICAL
  ENTONCES las solicitudes BEST_EFFORT son descartadas inmediatamente (fail-fast)
  Y las solicitudes HIGH y CRITICAL son admitidas utilizando la reserva de emergencia
  Y se garantiza la operación de los flujos vitales del negocio sin degradación

ESCENARIO: BDD-290 Descarte Temprano de Solicitudes Encoladas por Bufferbloat (CoDel)
  DADO un sistema con una cola de espera acumulada
  CUANDO una solicitud permanece en cola durante 25ms (superando el límite de 15ms)
  ENTONCES el gobernador detecta la expiración de permanencia en cola
  Y aborta la ejecución con código QUEUE_TIMEOUT_EXCEEDED
  Y previene el gasto inútil de ciclos de CPU en peticiones obsoletas
```

---

## 4. Mathematical Invariants

1. **Concurrency Limit Bounds**:
   $$\forall t, \quad \text{MinLimit} \le \text{Limit}_t \le \text{MaxLimit}$$
2. **Gradient Monotonicity**:
   $$\text{Gradient} \in (0, 1.0] \quad \text{when } RTT_{\text{current}} \ge RTT_{\text{baseline}}$$
3. **Priority Preservation**:
   $$\text{DropRate}(\text{CRITICAL}) \le \text{DropRate}(\text{HIGH}) \le \text{DropRate}(\text{NORMAL}) \le \text{DropRate}(\text{BEST\_EFFORT})$$
