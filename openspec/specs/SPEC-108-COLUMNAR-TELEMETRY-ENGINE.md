# SPEC-108: In-Memory Columnar Telemetry Slice Engine & Real-Time Anomaly Detector

## Metadata

- **Specification ID**: `SPEC-108`
- **Title**: In-Memory Columnar Telemetry Slice Engine & Real-Time Anomaly Detector (Meta SCUBA / Google Monarch Standard)
- **Status**: `APPROVED`
- **Lifecycle Phase**: `Core Infrastructure / High-Performance Observability (Layer 0)`
- **Governing Laws**: `Law I (Spec Truth)`, `Law III (Epistemic Evidence)`, `Law IV (Write Barrier)`, `Law V (Hexagonal Isolation)`
- **Functional Requirements**: `FR-285`, `FR-286`, `FR-287`, `FR-288`
- **BDD Scenarios**: `BDD-276`, `BDD-277`, `BDD-278`
- **Architecture Decision Record**: `ADR-108`
- **Mathematical Invariants**: `ColumnarCapacityBoundedInvariant`, `DictionaryEncodingBijectionInvariant`, `AnomalyZScoreThresholdInvariant`

---

## 1. Context & Business Domain

Big Tech observability platforms (Meta SCUBA, Google Monarch, Uber AresDB, Netflix Atlas) discard slow row-oriented JSON telemetry parsing in favor of contiguous in-memory columnar stores.

When EOS monitors high-frequency telemetry events across 5 fleet repositories (response times, HTTP status codes, memory usage, eBPF probe events, canary deployment slices), processing raw objects introduces:

1. **Garbage Collection (GC) Pressure**: Continuous object allocation causes unpredictable V8 GC pauses (stop-the-world).
2. **Cache Thrashing**: Pointer chasing across heap objects prevents CPU cache prefetching.
3. **Slow Aggregation Queries**: Scanning $100,000$ raw JSON objects takes $> 50\text{ms}$, making real-time sub-millisecond alerting impossible.

SPEC-108 introduces `EosColumnarTelemetryEngine`: a contiguous, zero-allocation columnar memory store with dictionary-encoded string dimensions, sub-millisecond percentile calculations (P50, P90, P99), and streaming $Z$-score anomaly detection.

---

## 2. Requirements Engineering (IEEE 830 / ISO 29148 Standard in EARS Syntax)

### FR-285: Contiguous Columnar Buffer Allocation & Ingestion (Ubiquitous Pattern)

- **EARS**: `EL SISTEMA mantendrá buffers contiguos en TypedArrays (Float64Array para latencias y métricas numéricas, Uint32Array para marcas de tiempo, Uint16Array para dimensiones codificadas por diccionario), garantizando almacenamiento columnar acotado con política circular sin fugas de memoria.`

### FR-286: Dictionary-Encoded String Dimensions (Event-Driven Pattern)

- **EARS**: `CUANDO se registre una dimensión textual (nombre de repositorio, entorno, ruta, código de estado), EL SISTEMA asignará un identificador numérico entero de 16 bits mediante codificación por diccionario biyectiva con resolución en tiempo O(1).`

### FR-287: Zero-Allocation Microsecond Vector Aggregation (State-Driven Pattern)

- **EARS**: `MIENTRAS se consulten agregaciones de telemetría (conteo, promedio, P50, P90, P99, min, max) sobre una ventana temporal o filtro dimensional, EL SISTEMA ejecutará el escaneo vectorial sin asignar objetos intermediarios en el heap con latencia inferior a 2 milisegundos.`

### FR-288: Streaming Z-Score Anomaly Detection (Error / Unwanted Condition Pattern)

- **EARS**: `SI una muestra de latencia o tasa de error se desvía en más de 3.0 desviaciones estándar respecto a la media móvil exponencial (|Z| > 3.0), ENTONCES EL SISTEMA etiquetará la anomalía (ANOMALY_DETECTED) y emitirá una alerta temprana de degradación con recibo criptográfico SHA-256.`

---

## 3. BDD Acceptance Criteria (Gherkin Syntax)

```gherkin
ESCENARIO: BDD-276 Ingesta Columnar de Alta Velocidad y Codificación de Diccionario
  DADO un motor EosColumnarTelemetryEngine inicializado con capacidad fija
  CUANDO se ingieren 10,000 eventos de telemetría multidimensional
  ENTONCES todos los registros se almacenan en Float64Array y Uint16Array contiguos
  Y las dimensiones de texto se resuelven en IDs numéricos de diccionario sin duplicación
  Y la memoria ocupada permanece estrictamente acotada

ESCENARIO: BDD-277 Consulta Vectorial y Cálculo de Percentiles en Sub-Milisegundos
  DADO un almacén columnar con 10,000 registros de telemetría
  CUANDO se ejecuta una consulta agregada filtrando por repositorio y ventana temporal
  ENTONCES se calculan count, mean, min, max, P50, P90 y P99 con precisión matemática
  Y el tiempo total de cómputo del escaneo vectorial es inferior a 2 milisegundos

ESCENARIO: BDD-278 Detección Streaming de Anomalías mediante Z-Score
  DADO un flujo continuo de telemetría con distribución estable (media 45ms, desvío 5ms)
  CUANDO ingresa un evento anómalo con latencia de 180ms (|Z| > 3.0)
  ENTONCES el motor clasifica el evento con anomaly = true y zScore > 3.0
  Y se genera un recibo SHA-256 determinista para la alerta de observabilidad
```

---

## 4. Mathematical & Formal Invariants

1. **`ColumnarCapacityBoundedInvariant`**:
   $$\forall t, \quad 0 \le \text{Count}(t) \le \text{Capacity} \quad \land \quad \text{MemoryUsage}(t) = O(\text{Capacity})$$
2. **`DictionaryEncodingBijectionInvariant`**:
   $$\forall s \in \text{Strings}, \quad \text{Decode}(\text{Encode}(s)) = s \quad \land \quad \text{ID} \in [0, 65535]$$
3. **`AnomalyZScoreThresholdInvariant`**:
   $$Z(x) = \frac{x - \mu}{\sigma} \implies (\text{Anomaly} \iff |Z(x)| > 3.0)$$
