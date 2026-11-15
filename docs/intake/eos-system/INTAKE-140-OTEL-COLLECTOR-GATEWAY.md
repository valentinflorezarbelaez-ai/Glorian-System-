# INTAKE-140: OpenTelemetry Distributed Tracing & High-Throughput OTLP Collector Gateway

## Big Tech Observability & Tail-Based Trace Sampling (SPEC-278)

---

### 1. Context & Business Need

In modern microservices and serverless architectures (Google, Meta, Uber, Netflix), distributed systems generate millions of telemetry spans per minute. Naive observability systems suffer from two fatal pitfalls:

1. **Head-Based Sampling Blindness**: Randomly dropping 90% or 99% of spans at the start of a request means that when an intermittent, catastrophic P99 tail latency spike or 500 Internal Server Error occurs, the corresponding distributed trace was discarded before the error surfaced.
2. **Collector Memory Bloat & GC Pressure**: High-throughput JSON parsing and heap allocations in collector gateways trigger Node.js V8 garbage collection pauses, inflating system tail latency.

### 2. Big Tech References & Engineering Patterns

- **Google Dapper / OpenTelemetry Standard**: Standardized W3C TraceContext (`traceparent` header format `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`) and standardized span attributes (`http.status_code`, `service.name`, `rpc.method`).
- **Uber Jaeger / Honeycomb Tail-Based Sampling**: Buffering spans until the full distributed transaction completes, then preserving 100% of error spans and slow outlier traces while down-sampling nominal happy-path traffic.
- **Ring Buffer Zero-Allocation Design**: Fixed-capacity ring buffers that recycle pre-allocated memory slots, eliminating heap thrashing.

### 3. Proposed Core Capabilities

1. **High-Throughput OTLP Trace Ingestion (`ingestSpans`)**:
   - Ingests standard OpenTelemetry payload structures (`resourceSpans`, `scopeSpans`, `spans`).
   - Supports both OTLP JSON and in-process span objects.
2. **Tail-Based Sampling Engine (`evaluateSampling`)**:
   - Classifies spans by status (`OK`, `UNSET`, `ERROR`) and duration.
   - Preserves 100% of traces where `status.code === 2` (Error) or `http.status_code >= 500`.
   - Preserves traces with duration exceeding the configured tail threshold (e.g., > 250ms).
   - Uniformly samples nominal traces at the configured baseline rate (e.g., 5%).
3. **Trace Aggregator & Percentile Metrics (`computeMetrics`)**:
   - Calculates P50, P90, P95, and P99 latency percentiles across ingested span batches.
   - Tracks error rates and throughput (spans/sec).
4. **Cryptographic SHA-256 Receipt**:
   - Emits verifiable execution report in `docs/evidence/OTEL_RECEIPT.json`.
5. **CLI Integration & Paridad**:
   - `eos toolchain:otel:ingest <file.json>`: Ingests and samples OTLP trace batch.
   - `eos toolchain:otel:spans [--errors] [--limit=N]`: Inspects captured spans.
   - `eos toolchain:otel:stats`: Computes latency percentiles and sampling efficiency.

### 4. Constraints

- Pure Layer-0 TypeScript (`dependencies: {}` - Law V).
- Serverless function count remains strictly 12/12 (`SPEC-269`).
- Maximum module lines observed $\le 748$ lines.
- 100% CLI catalog parity with `hygiene:audit` (366 commands upon completion).
