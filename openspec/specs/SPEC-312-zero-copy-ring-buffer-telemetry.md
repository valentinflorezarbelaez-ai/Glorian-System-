# SPEC-312 — Zero-Copy Circular Ring-Buffer Telemetry & OTLP Streaming Bridge

- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`
- **Milestone**: `v76.0.0`
- **TLA+ Companion**: `docs/formal/ZeroCopyRingBuffer.tla`

---

## 1. Functional Requirements (IEEE 830 EARS)

### FR-1: Power-of-2 Ring Buffer Allocation & Memory Layout

- **Pattern**: Ubiquitous / Permanent
- **EARS**: THE SYSTEM SHALL allocate an aligned memory arena formatted with a 64-byte cache-line padded header containing magic bytes `0x454F5352`, a power-of-2 capacity, and sequential 64-byte event slots.

### FR-2: SPSC & MPSC Atomic Event Ingestion

- **Pattern**: Event-Driven
- **EARS**: CUANDO a producer emits a telemetry event, EL SISTEMA SHALL atomically advance the `HEAD` index using atomic compare-and-swap or addition and write the 64-byte payload into slot index `(head & (capacity - 1))` without heap allocations.

### FR-3: Backpressure & Drop Policy Handling

- **Pattern**: Error / Unwanted Condition
- **EARS**: SI the buffer is full (`(head - tail) >= capacity`), ENTONCES EL SISTEMA SHALL either atomically increment `DROPPED` and advance the tail (`DROP_OLDEST`) or return a failure status (`FAIL_FAST`) according to the configured backpressure policy.

### FR-4: Atomic Batch Event Draining

- **Pattern**: Event-Driven
- **EARS**: CUANDO a consumer drains events, EL SISTEMA SHALL atomically claim up to `maxBatch` available slots (`min(available, maxBatch)`), decode binary records directly from the typed array, and advance the `TAIL` index.

### FR-5: Zero-Copy OTLP / Prometheus Streaming Bridge

- **Pattern**: Event-Driven
- **EARS**: CUANDO the telemetry bridge streams drained events into Prometheus / OTLP registries, EL SISTEMA SHALL update metric counters and gauges directly from the binary slot values without allocating intermediate JSON strings.

### FR-6: Structural Invariant Verification & Cryptographic Receipt

- **Pattern**: Ubiquitous / Permanent
- **EARS**: EL SISTEMA SHALL audit header magic, power-of-2 capacity alignment, monotonic sequence progression, and zero torn reads, emitting a signed SHA-256 evidence receipt at `docs/evidence/ZERO_COPY_RING_BUFFER_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD / Gherkin)

### BDD-1647: Power-of-2 Ring Buffer Allocation & Header Alignment

```gherkin
ESCENARIO: Validar inicialización de arena y cabecera de 64 bytes
  DADO un requerimiento de buffer con capacidad 1024 slots y tamaño de slot 64 bytes
  CUANDO se inicializa el RingBuffer con createZeroCopyRingBuffer
  ENTONCES el tamaño total en bytes es exactamente 64 + (1024 * 64) bytes
  Y los primeros 4 bytes corresponden al número mágico 0x454F5352 ("EOSR")
  Y el índice HEAD y TAIL inician en 0 con DROPPED en 0
```

### BDD-1648: SPSC Lock-Free Atomic Push and Drain

```gherkin
ESCENARIO: Ingesta y vaciado secuencial atómico de eventos
  DADO un RingBuffer inicializado con capacidad 64
  CUANDO un productor inserta 10 eventos de métricas secuenciales
  ENTONCES la función push retorna éxito para los 10 eventos
  Y el drenado de eventos retorna exactamente 10 eventos con los mismos valores
  Y el índice TAIL avanza a 10 y el buffer queda vacío
```

### BDD-1649: MPSC Concurrent Push with Atomic Index Reservation

```gherkin
ESCENARIO: Inserción concurrente multi-productor
  DADO un RingBuffer en memoria compartida (SharedArrayBuffer) con capacidad 256
  CUANDO 4 productores concurrentes reclaman índices con Atomics.add
  ENTONCES ningún índice es reclamado por más de un productor
  Y todos los eventos son ubicados en ranuras discretas sin solapamiento
```

### BDD-1650: Backpressure and Drop Policies

```gherkin
ESCENARIO: Comportamiento ante desbordamiento con DROP_OLDEST y FAIL_FAST
  DADO un RingBuffer con capacidad 16
  CUANDO se insertan 20 eventos con política FAIL_FAST
  ENTONCES los primeros 16 tienen éxito y los 4 siguientes fallan
  CUANDO se insertan 20 eventos con política DROP_OLDEST
  ENTONCES los 20 son aceptados y el contador DROPPED se incrementa a 4
```

### BDD-1651: Zero-Copy Telemetry Bridge into Prometheus Metrics

```gherkin
ESCENARIO: Transmisión directa de métricas binarias sin asignación de heap
  DADO un RingBuffer con 50 eventos GAUGE y COUNTER binarios
  CUANDO streamRingBufferToPrometheus procesa los eventos
  ENTONCES los acumuladores de Prometheus reflejan exactamente las sumas y últimos valores
  Y no se crean objetos JSON intermediarios
```

### BDD-1652: Performance Benchmark & Invariant Audit

```gherkin
ESCENARIO: Auditoría integral y benchmark de nanosegundos
  DADO un RingBuffer bajo prueba de throughput de 100,000 eventos
  CUANDO se ejecuta benchmarkRingBufferThroughput
  ENTONCES el rendimiento supera los 2,000,000 eventos/segundo con latencia < 100 ns/op
  Y auditRingBufferInvariants confirma que 0 invariantes han sido violados
```
