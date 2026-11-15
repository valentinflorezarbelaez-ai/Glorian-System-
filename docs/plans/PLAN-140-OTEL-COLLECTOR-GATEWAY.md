# PLAN-140: OpenTelemetry Distributed Tracing & High-Throughput OTLP Collector Gateway

## Observability, High-Throughput Ingestion & Tail-Based Sampling (SPEC-278)

---

### 1. Architectural Strategy

- **Layer-0 OTLP Span Parser**:
  - Implements lightweight zero-dependency JSON ingestion in `src/core/eosOtlpCollectorGateway.ts`.
  - Normalizes standard OpenTelemetry protobuf-mapped JSON structure:
    `{ resourceSpans: [ { scopeSpans: [ { spans: [ ... ] } ] } ] }` as well as flattened span array representations.
  - Normalizes durations (supports nanoseconds `startTimeUnixNano` / `endTimeUnixNano` and direct millisecond timestamps).
- **Tail-Based Sampling Engine**:
  - Categorizes spans into:
    1. `ERROR`: `status.code === 2` or `span.attributes["http.status_code"] >= 500` or `span.attributes["error"] === true`. Always preserved (100%).
    2. `LATENCY_OUTLIER`: Duration exceeds configured threshold (default 250ms). Always preserved (100%).
    3. `NOMINAL`: Error-free, duration below threshold. Down-sampled probabilistically according to configured `sampleRate` (e.g. 5% or user-defined rate using deterministic hashing of `traceId`).
- **Memory-Bounded Ring Buffer**:
  - Bounded storage array with max capacity (default 10,000 spans) to prevent runaway memory usage during traffic surges.
- **Percentile Engine**:
  - In-place numeric sort of durations for P50, P90, P95, and P99 calculation.
- **CLI Subcommand Delegation**:
  - Dedicated CLI module in `bin/commands/cliOtelGateway.mjs` (~140 lines).
  - Subcommands `toolchain:otel:ingest`, `toolchain:otel:spans`, `toolchain:otel:stats` wired into `bin/commands/cliDevOps.mjs` preserving module headroom.

### 2. File Invariants

- `src/core/eosOtlpCollectorGateway.ts` ($\le 380$ lines).
- `bin/commands/cliOtelGateway.mjs` ($\le 140$ lines).
- `test/eosOtlpCollectorGateway.test.mjs` ($\le 250$ lines).
- Sample OTLP traces template in `templates/otel/sample-otlp-traces.json`.
