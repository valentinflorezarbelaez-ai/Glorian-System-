# CHANGE-084: Sovereign OpenTelemetry Distributed Tracing & Real-Time Cockpit Observability

- **Change ID**: `CHANGE-084`
- **Specification ID**: `SPEC-149`
- **Status**: `APPLIED_AND_VERIFIED`
- **Authorization Level**: `LEVEL_3_PRODUCTION_AUTHORIZED`
- **Impacted Specifications**: `SPEC-149-OPENTELEMETRY-DISTRIBUTED-TRACING.md`, `SPEC-113-TAIL-BASED-TRACE-SAMPLER.md`, `SPEC-140-MCP-STREAMABLE-HTTP-TRANSPORT.md`, `SPEC-145-REPOSITORY-KNOWLEDGE-GRAPH.md`, `SPEC-148-PLATFORM-OPS-CEILING.md`
- **Modules Added / Modified**:
  - `src/core/eosOtelDistributedTracing.ts`
  - `test/eosOtelDistributedTracing.test.mjs`
  - `src/mcp/eosMcpServer.ts`
  - `bin/eos.mjs`
  - `public/eosStudioConsole.html`
  - `docs/contracts/mcp-tool-catalog.json`

## Intent
Unify Glorian control-plane observability into a canonical Layer-0 OpenTelemetry OTLP/JSON distributed tracing engine with W3C trace context propagation, SQLite WAL persistence, automated MCP tool instrumentation, and interactive waterfall analysis.
