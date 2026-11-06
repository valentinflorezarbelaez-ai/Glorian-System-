# SPEC-149: Sovereign OpenTelemetry Distributed Tracing & Real-Time Cockpit Observability

## 1. Specification Metadata
- **Specification ID**: `SPEC-149`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 & BDD Gherkin
- **Ladder / Gate**: `LADDER-17` / `GATE-17` (Distributed Trace Nervous System)
- **Related Specs**: `SPEC-113`, `SPEC-109`, `SPEC-110`, `SPEC-140`, `SPEC-145`, `SPEC-147`
- **Module Target**: `src/core/eosOtelDistributedTracing.ts`, `test/eosOtelDistributedTracing.test.mjs`

---

## 2. Functional Requirements (EARS Syntax)

- **FR-460 (Ubiquitous / Trace Identity)**: `THE SYSTEM SHALL generate deterministic 128-bit (32-hex) traceId and 64-bit (16-hex) spanId values, recording span start and end timestamps in monotonic nanosecond precision.`
- **FR-461 (Ubiquitous / Context Propagation)**: `THE SYSTEM SHALL inject and extract W3C Trace Context level 1 headers (00-{traceId}-{spanId}-{flags}) with fail-safe parsing and default sampling flags.`
- **FR-462 (Event-Driven / Persistence)**: `WHEN a span ends, THE SYSTEM SHALL persist the span record to data/eos_telemetry.db in SQLite WAL mode with indexed B-Tree lookups on traceId, name, status, and duration.`
- **FR-463 (Event-Driven / Waterfall Analysis)**: `WHEN a trace is queried by traceId, THE SYSTEM SHALL assemble the complete span hierarchy, calculate child offset and width percentages relative to the root span, and identify the critical path bottleneck span.`
- **FR-464 (Event-Driven / MCP Instrument)**: `WHEN any MCP tool is invoked, THE SYSTEM SHALL automatically create an active span with tool name, request ID, arguments metadata, duration, and completion or error status.`
- **FR-465 (Ubiquitous / OTLP Export)**: `THE SYSTEM SHALL export recorded traces in OpenTelemetry OTLP/JSON schema v1.3.0 (resourceSpans, scopeSpans, attributes, events) directly compatible with Jaeger, Honeycomb, and Grafana Tempo.`
- **FR-466 (Ubiquitous / Layer-0 Purity)**: `THE SYSTEM SHALL execute all distributed tracing, SQLite persistence, and OTLP formatting with zero external npm dependencies.`

---

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: BDD-440 W3C Traceparent injection and extraction roundtrip
  GIVEN a valid traceId "4bf92f3577b34da6a3ce929d0e0e4736" and spanId "00f067aa0ba902b7"
  WHEN injectW3cTraceparent is called with sampled true
  THEN the output header equals "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
  AND WHEN parseW3cTraceparent is called with that header
  THEN extracted traceId, spanId, and sampled flags match exactly

SCENARIO: BDD-441 Span lifecycle, nanoseconds, attributes, and events
  GIVEN an active tracer instance
  WHEN startSpan is called with name "core.computation" and attributes { "tier": 0 }
  AND addEvent is called with name "cache_hit"
  AND endSpan is called with status "OK"
  THEN durationNs is greater than 0
  AND span contains the recorded attributes and timestamped event

SCENARIO: BDD-442 Durable SQLite WAL trace storage and query
  GIVEN a trace with 3 nested spans (root, childA, childB)
  WHEN the spans are ended and stored in data/eos_telemetry.db
  AND queryTraces is called with traceId
  THEN exactly 3 spans are returned with correct parentSpanId relations
  AND SQLite database operates in WAL mode with busy_timeout >= 10000ms

SCENARIO: BDD-443 Hierarchical trace waterfall and critical path bottleneck
  GIVEN a trace with a root span and 2 children with distinct durations
  WHEN computeTraceWaterfall is invoked
  THEN each span has depth, offsetPercent, and widthPercent calculated
  AND bottleneckSpanId points to the span with greatest execution duration

SCENARIO: BDD-444 Automated MCP tool invocation instrumentation
  GIVEN an active EosMcpServer with tracing enabled
  WHEN tool "eos_query_knowledge_graph" is invoked
  THEN an active span named "mcp.tool.eos_query_knowledge_graph" is recorded
  AND attributes include mcp.tool_name and mcp.duration_ms
  AND status is "OK" for valid arguments

SCENARIO: BDD-445 Canonical OpenTelemetry OTLP/JSON export
  GIVEN a set of recorded spans
  WHEN exportOtlpJson is called
  THEN the returned JSON structure contains resourceSpans, scopeSpans, and spans
  AND complies with OpenTelemetry OTLP JSON Schema v1.3.0
```
