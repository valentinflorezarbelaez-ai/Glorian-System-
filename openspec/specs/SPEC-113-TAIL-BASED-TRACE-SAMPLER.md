# SPEC-113: Dynamic Tail-Based Distributed Trace Sampler

## 1. Overview & Objective

This specification establishes the architectural standard for autonomous tail-based distributed trace sampling across the EOS fleet. Operating on the Google Dapper and Honeycomb tail-sampling doctrines, this sampler captures 100% of anomalies, errors, and tail latency stragglers while discarding over 99.9% of nominal repetitive spans. By evaluating sampling decisions at the conclusion of a trace rather than its inception, this system eliminates critical diagnostic blindness, bounds egress bandwidth, and guarantees cryptographic auditability.

---

## 2. Functional Requirements (IEEE 830 / Formal EARS)

### FR-305: In-Flight Trace Span Aggregation & Buffering

- **Ubiquitous**: EL SISTEMA mantendrá un búfer en memoria de tramos (_spans_) correlacionados por su identificador único de traza (`traceId`), acumulando metadatos de inicio, fin, latencia, atributos y estado de ejecución sin tomar decisiones de descarte prematuras.
- **State-Driven**: MIENTRAS una traza continúe en ejecución y emita tramos secundarios (_child spans_), EL SISTEMA anexará cada tramo al registro de la traza activa de forma atómica en tiempo $O(1)$.

### FR-306: Deterministic Anomaly & Error Preservation (100% Retention)

- **Event-Driven**: CUANDO una traza finalice su tramo raíz o se declare completada, EL SISTEMA evaluará la presencia de anomalías:
  - Si algún tramo contiene un código de error (`statusCode >= 500`, flag de excepción o error interno), EL SISTEMA muestreará y preservará la traza al **100%** (`SAMPLE_REASON_ERROR`).
  - Si la duración total acumulada de la traza excede el umbral de latencia de cola ($\Delta t_{\text{trace}} > \text{LatencyThresholdMs}$, por defecto 500ms), EL SISTEMA preservará la traza al **100%** (`SAMPLE_REASON_HIGH_LATENCY`).
  - Si algún tramo registra intervención de resiliencia (solicitud duplicada por _hedged request_, activación de _circuit breaker_ o degradación por _load shedding_), EL SISTEMA preservará la traza al **100%** (`SAMPLE_REASON_RESILIENCE_EVENT`).

### FR-307: Dynamic Nominal Baseline Sampling & Drop Decoupling

- **Ubiquitous**: EL SISTEMA aplicará una tasa de muestreo nominal uniforme ($\text{NominalSampleRate}$, por defecto 0.1% o 1 de cada 1,000) a las trazas nominales que hayan concluido sin errores y por debajo del umbral de latencia.
- **State-Driven**: MIENTRAS una traza saludable sea evaluada, EL SISTEMA descartará el restante 99.9% de trazas redundantes (`DROPPED_NOMINAL_TRACE`), liberando de inmediato el búfer asociado y emitiendo únicamente métricas sintéticas de conteo para conservar memoria y ancho de banda.

### FR-308: Bounded Span Eviction & TTL Garbage Collection

- **Error / Unwanted Condition**: SI una traza permanece abierta en el búfer sin recibir tramos adicionales ni declarar su cierre por un período superior al tiempo máximo de permanencia ($\Delta t_{\text{idle}} > \text{MaxRetentionWindowMs}$, por defecto 60 segundos), ENTONCES EL SISTEMA forzará la evaluación de descarte o expulsión con estado `EVICTED_TTL_EXPIRED`, previniendo fugas de memoria o saturación por peticiones zombies o abortadas.

---

## 3. Acceptance Criteria (BDD / Gherkin)

```gherkin
ESCENARIO: BDD-291 Preservación al 100% de Trazas con Error o Excepción
  DADO un muestreador de trazas configurado con tasa nominal de 0.1%
  CUANDO arriba una traza con 5 tramos donde uno de ellos falla con código HTTP 503
  ENTONCES el muestreador de cola evalúa la traza completa tras su finalización
  Y decide preservarla al 100% con motivo SAMPLE_REASON_ERROR
  Y emite un recibo criptográfico SHA-256 de la decisión de muestreo

ESCENARIO: BDD-292 Preservación al 100% de Retrasos en Cola de Latencia (Tail Latency Stragglers)
  DADO un umbral de latencia de cola configurado en 300ms
  CUANDO arriba una traza exitosa (código 200) cuya duración total es de 650ms
  ENTONCES el muestreador clasifica la traza como anomalía de latencia
  Y retiene la traza al 100% con motivo SAMPLE_REASON_HIGH_LATENCY
  Y evita la ceguera diagnóstica habitual del muestreo en cabecera

ESCENARIO: BDD-293 Descarte del 99.9% de Trazas Nominales y Liberación Inmediata de Memoria
  DADO un flujo continuo de 1,000 trazas rápidas (latencia < 20ms) y sin errores
  CUANDO el muestreador procesa y finaliza las 1,000 trazas
  ENTONCES exactamente 1 traza es seleccionada para la muestra base (0.1%)
  Y las restantes 999 trazas son descartadas liberando sus búferes en memoria
  Y se emite un resumen métrico con recuento de trazas procesadas, retenidas y descartadas
```

---

## 4. Mathematical Invariants

1. **Sampling Soundness for Anomalies**:
   $$\forall T \in \text{CompletedTraces}, \quad (\text{hasError}(T) \lor \text{duration}(T) > \text{LatencyThreshold}) \implies \text{Sampled}(T) = \text{true}$$

2. **Buffer Capacity Bounds**:
   $$\forall t, \quad |\text{ActiveBuffers}_t| \le \text{MaxActiveTraces}$$

3. **Conservation of Completed Traces**:
   $$\text{TracesCompleted} = \text{TracesSampledErrors} + \text{TracesSampledLatency} + \text{TracesSampledNominal} + \text{TracesDroppedNominal}$$
