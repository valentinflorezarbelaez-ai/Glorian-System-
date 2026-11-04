# PLAN-149: Sovereign OpenTelemetry Distributed Tracing & Real-Time Cockpit Observability

## 1. Architectural Decision Records (ADRs)

### ADR-0190: Pure Layer-0 OpenTelemetry OTLP/JSON Implementation
- **Context**: OpenTelemetry's official Node.js SDK pulls in dozens of npm dependencies (protobufjs, semantic-conventions, grpc, etc.), violating Law V (Clean/Hexagonal Purity) and the Glorian constitution (`runtimeDependenciesCount: 0`).
- **Decision**: Implement a native, zero-dependency OpenTelemetry trace engine in pure TypeScript (`src/core/eosOtelDistributedTracing.ts`) adhering strictly to the OTLP/JSON v1.3.0 schema and W3C Trace Context specifications.
- **Rejected Alternatives**:
  - *Adopt `@opentelemetry/api` and `@opentelemetry/sdk-trace-base`*: Rejected — breaks Layer-0 zero-npm runtime invariants.
  - *Keep ad-hoc logging without standard schema*: Rejected — fails big-tech interoperability requirements (cannot stream to Jaeger, Grafana Tempo, or Honeycomb).

### ADR-0191: SQLite WAL Engine for Durable Trace Storage & CTE Querying
- **Context**: In-memory trace stores drop historical traces upon process reload and fail under multi-agent concurrent workloads.
- **Decision**: Store spans in a dedicated SQLite database in WAL mode (`data/eos_telemetry.db`), utilizing indexed B-Trees and recursive CTEs for hierarchical child span traversal and waterfall computation.
- **Rejected Alternatives**:
  - *Pure in-memory circular ring buffer*: Rejected — lacks durability across server restarts.
  - *Appending to unstructured NDJSON log files*: Rejected — querying span hierarchies requires full file scans ($O(N)$), leading to high latency.

### ADR-0192: Automated MCP Server Middleware Instrumentation
- **Context**: Manual span creation inside each MCP handler leads to code duplication and missing spans.
- **Decision**: Intercept MCP tool invocations inside `EosMcpServer.handleRequest()` at the routing layer, automatically wrapping every tool dispatch in an OpenTelemetry root span with standard semantic conventions (`mcp.tool_name`, `mcp.request_id`, `mcp.duration_ms`).
- **Rejected Alternatives**:
  - *Manual span creation in each of 188 tools*: Rejected — brittle, high maintenance, prone to omission.

---

## 2. Component Design
```text
Client / MCP Client / HTTP
         │
         ▼
[ W3C Traceparent Injected / Extracted ]
         │
         ▼
[ EosOtelTraceEngine.startSpan() ]
  ├── 128-bit traceId / 64-bit spanId
  ├── Monotonic nanosecond clock (hrtime.bigint)
  └── Attributes & timestamped events
         │
         ▼
[ Execution of Domain / Application / MCP Tool ]
         │
         ▼
[ EosOtelTraceEngine.endSpan() ]
  ├── Computes durationNs / durationMs
  ├── Evaluates status (OK / ERROR)
  └── Persists to data/eos_telemetry.db (SQLite WAL)
         │
         ▼
[ Export / Query Surface ]
  ├── exportOtlpJson() ────► OTLP/JSON v1.3.0 (Jaeger/Tempo)
  ├── getTraceWaterfall() ─► Hierarchical waterfall + Bottleneck
  └── eosStudioConsole.html ─► Live interactive Cockpit view
```
