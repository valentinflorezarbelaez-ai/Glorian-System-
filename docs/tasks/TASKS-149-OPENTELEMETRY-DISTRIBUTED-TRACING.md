# TASKS-149: Sovereign OpenTelemetry Distributed Tracing & Real-Time Cockpit Observability

## Task DAG & Execution Sequence

- [x] **TASK-149-01**: Implement `src/core/eosOtelDistributedTracing.ts`
  - W3C Trace Context injection / extraction (`traceparent`).
  - TraceId (128-bit) and SpanId (64-bit) generation.
  - Span lifecycle (`startSpan`, `endSpan`, `addEvent`, `setAttribute`, `setStatus`).
  - Durable SQLite WAL engine (`data/eos_telemetry.db`) with `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;`.
  - Hierarchical trace waterfall calculator with bottleneck detection.
  - OTLP/JSON v1.3.0 exporter.
- [x] **TASK-149-02**: Implement Test Suite `test/eosOtelDistributedTracing.test.mjs`
  - Verify BDD-440 (W3C Traceparent injection/extraction).
  - Verify BDD-441 (Span lifecycle and nanosecond precision).
  - Verify BDD-442 (Durable SQLite WAL trace storage and querying).
  - Verify BDD-443 (Trace waterfall calculation and bottleneck isolation).
  - Verify BDD-444 (Automated MCP tool invocation instrumentation).
  - Verify BDD-445 (Canonical OpenTelemetry OTLP/JSON export).
- [x] **TASK-149-03**: Integrate Tracing into `src/mcp/eosMcpServer.ts`
  - Wrap tool execution in active spans automatically.
  - Register MCP tools: `eos_otel_query_traces`, `eos_otel_trace_waterfall`, `eos_otel_export_otlp`.
  - Update `docs/contracts/mcp-tool-catalog.json`.
- [x] **TASK-149-04**: Add CLI Commands to `bin/eos.mjs`
  - Add `eos trace:query [traceId]`
  - Add `eos trace:waterfall <traceId>`
  - Add `eos trace:export <traceId>`
- [x] **TASK-149-05**: Enhance Cockpit in `src/ui/eosStudioConsole.html`
  - Add interactive Trace Viewer tab showing live spans and waterfall charts.
- [x] **TASK-149-06**: Verify 7/7 Sovereign Local Gate & Supply Chain
  - Re-generate CycloneDX SBOM and in-toto SLSA Provenance.
  - Execute full local gate (`verify:strict`) with 0 warnings.
  - Commit and push to `origin/main`.
