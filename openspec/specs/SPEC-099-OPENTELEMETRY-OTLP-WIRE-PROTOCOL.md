# SPEC-099: LAYER-0 OPENTELEMETRY (OTLP v1) DISTRIBUTED TRACING ENGINE

## 1. Specification Metadata
- **Spec ID**: `SPEC-099`
- **Change**: `CHANGE-067`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `75.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-358: W3C Distributed Context Propagation
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA generará y propagará identificadores de contexto distribuidos conforme al estándar W3C Trace Context, formateando la cabecera `traceparent` como `00-${traceId}-${spanId}-${traceFlags}` (donde `traceId` son 32 caracteres hexadecimales, `spanId` son 16 caracteres hexadecimales y `traceFlags` es `01` para spans muestreados).

### FR-359: High-Resolution Monotonic Span Recording
- **Pattern (Event-Driven)**: CUANDO se inicie un bloque de ejecución trazado mediante `eosOtlpTelemetryEngine.startSpan(name, attributes)`, EL SISTEMA registrará la marca de tiempo de inicio con precisión de nanosegundos (`process.hrtime.bigint()`), acumulando atributos semánticos tipados sin bloquear el bucle de eventos.

### FR-360: Layer-0 OTLP v1 Wire Protocol Serializer
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA serializará lotes de spans en el formato de transporte JSON estándar de OpenTelemetry Protocol (`/v1/traces`), incluyendo ResourceSpans, ScopeSpans y Spans con códigos de estado canónicos (`STATUS_CODE_OK = 1`, `STATUS_CODE_ERROR = 2`), garantizando interoperabilidad con Jaeger, Tempo, Datadog y Honeycomb con 0 dependencias npm externas.

### FR-361: Memory-Bounded Ring Buffer & Load Shedding
- **Pattern (Error / Unwanted Condition)**: SI el búfer de spans en memoria supera el límite configurado (por defecto 1,024 spans), ENTONCES EL SISTEMA aplicará una política de descarte FIFO (*drop-oldest*) o muestreo adaptativo sin generar excepciones ni fugas de memoria.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-273: Propagación y formato estricto de W3C TraceContext en spans OTLP
  DADO el motor src/core/eosOtlpTelemetryEngine.ts
  CUANDO se crea un span raíz y un span hijo
  ENTONCES ambos comparten el mismo traceId de 32 caracteres hexadecimales
  Y el span hijo referencia correctamente el spanId del padre como parentSpanId.

ESCENARIO: BDD-274: Serialización conforme al protocolo OpenTelemetry OTLP v1 HTTP/JSON
  DADO un lote de spans completados con atributos semánticos
  CUANDO se invoca el exportador exportOtlpJsonBatch()
  ENTONCES genera la estructura JSON válida con "resourceSpans", "scopeSpans" y "spans"
  Y calcula la duración en nanosegundos con códigos de estado canónicos de OTLP.
```
