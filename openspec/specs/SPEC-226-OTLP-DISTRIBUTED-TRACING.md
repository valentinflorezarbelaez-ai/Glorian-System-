# SPEC-226: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine

## 1. Specification Metadata

- **Specification ID**: `SPEC-226`
- **Change ID**: `CHANGE-111`
- **Title**: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine (`EosOtlpDistributedTracingCore`)
- **Status**: `APPROVED`
- **Target Subsystem**: `src/core/eosOtlpDistributedTracingCore.ts`
- **Related Specs**: `SPEC-072` (OpenMetrics Prometheus Exporter), `SPEC-186` (Enterprise Facade), `SPEC-225` (Universal Fleet Sync)

## 2. Mathematical Foundation & Protocol Design

- **W3C TraceContext Specification (W3C Recommendation 23 November 2021)**:
  - `traceparent` format: `version-trace_id-parent_id-trace_flags`
  - $version$: exactly 2 hex characters (`00`).
  - $trace\_id$: exactly 32 hex characters (16 bytes, non-all-zero).
  - $parent\_id$ / $span\_id$: exactly 16 hex characters (8 bytes, non-all-zero).
  - $trace\_flags$: exactly 2 hex characters (bit 0 = recorded/sampled: `01` or `00`).
- **Monotonic High-Resolution Timing**:
  - Span start time $t_{\text{start}}$ and end time $t_{\text{end}}$ are captured using `process.hrtime.bigint()` converted to Unix epoch nanoseconds.
  - Duration: $\Delta t = t_{\text{end}} - t_{\text{start}} \ge 0$ nanoseconds.
- **Canonical OpenTelemetry OTLP/HTTP-JSON Schema (v1.34+)**:
  ```json
  {
    "resourceSpans": [
      {
        "resource": {
          "attributes": [
            { "key": "service.name", "value": { "stringValue": "glorian-system" } }
          ]
        },
        "scopeSpans": [
          {
            "scope": { "name": "eos.core.tracer", "version": "75.0.0" },
            "spans": [
              {
                "traceId": "...",
                "spanId": "...",
                "parentSpanId": "...",
                "name": "...",
                "kind": 1,
                "startTimeUnixNano": "...",
                "endTimeUnixNano": "...",
                "attributes": [...],
                "status": { "code": 1 }
              }
            ]
          }
        ]
      }
    ]
  }
  ```
- **Cryptographic Attestation**:
  - Trace batch Merkle root or digest $\mathcal{D} = \text{SHA-256}(\text{serializedOtlpJson})$.

## 3. Functional Requirements (IEEE 830 EARS)

### FR-1149: W3C TraceContext Parsing and Formatting

- **Requirement**: The system SHALL parse and format compliant W3C `traceparent` headers (`00-{traceId}-{spanId}-{flags}`) and extract valid 16-byte trace IDs, 8-byte parent span IDs, and sample flags, rejecting malformed formats with fail-closed semantics.

### FR-1150: Hierarchical Span Lifecycle Management

- **Requirement**: WHEN a span is started (`startSpan`), THE SYSTEM SHALL allocate a 64-bit span identifier, record high-resolution start nanoseconds, bind optional parent context, and allow appending typed key-value attributes (string, int64, double, bool) and events.

### FR-1151: Span Completion and Status Finalization

- **Requirement**: WHEN a span is concluded (`endSpan`), THE SYSTEM SHALL assign the end nanoseconds timestamp, finalize the status (`UNSET`, `OK`, or `ERROR` with optional description), and enqueue the span into a bounded ring buffer.

### FR-1152: Canonical OTLP/HTTP-JSON Serialization

- **Requirement**: The system SHALL serialize all accumulated spans into the official OpenTelemetry OTLP/HTTP-JSON wire schema (`resourceSpans`), mapping span kinds (`INTERNAL=1`, `SERVER=2`, `CLIENT=3`, `PRODUCER=4`, `CONSUMER=5`) and status codes (`UNSET=0`, `OK=1`, `ERROR=2`).

### FR-1153: Bounded Ring Buffer and Cryptographic Attestation

- **Requirement**: THE SYSTEM SHALL bound trace storage to a configurable capacity ($N_{\max} = 1000$ spans by default), safely dropping oldest or rejecting overflows without memory leaks, and generate a SHA-256 cryptographic receipt over every exported batch.

## 4. Behavior-Driven Development Scenarios (Gherkin)

```gherkin
Feature: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine

  Scenario: BDD-1149 W3C TraceContext Header Generation and Parsing
    Given an execution context needing distributed tracing
    When generating a fresh trace context or parsing a valid W3C traceparent string
    Then a valid 32-character hex trace ID, 16-character hex span ID, and flags are produced, and malformed strings are rejected fail-closed.

  Scenario: BDD-1150 Hierarchical Active Span Creation and Attribute Binding
    Given an active trace session
    When creating a parent span and a child span with typed attributes
    Then the child span references the parent's span ID, shares the root trace ID, and stores typed attributes accurately.

  Scenario: BDD-1151 Span Timing and Status Transitions
    Given an in-flight span
    When ending the span with OK or ERROR status
    Then end nanoseconds are strictly greater than or equal to start nanoseconds and the status code is recorded.

  Scenario: BDD-1152 Canonical OTLP JSON Wire Serialization
    Given completed trace spans in the accumulator
    When exporting to OpenTelemetry OTLP JSON
    Then the output strictly conforms to resourceSpans / scopeSpans schema with correct attribute value typing.

  Scenario: BDD-1153 Bounded Buffer Overflow Handling and SHA-256 Receipt
    Given a tracer configured with maximum capacity
    When enqueuing spans exceeding the capacity
    Then overflow count is tracked, memory is bounded, and a 64-char SHA-256 digest is generated.
```
