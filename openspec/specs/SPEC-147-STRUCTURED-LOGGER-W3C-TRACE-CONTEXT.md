# SPEC-147: Structured Logger with W3C Trace-Context Propagation

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Free-text logging is unusable for large-scale diagnosis: correlation across services, modules and asynchronous boundaries is impossible when lines carry no machine-parseable identifiers. The Glorian System (EOS) mandates a Layer-0 observability contract where every emitted line is a JSON object carrying severity, module identity and distributed-trace identifiers.

Following the Google SRE doctrine of **structured logging** cited in the module header of `src/core/eosStructuredLogger.ts`, the `EosStructuredLogger` emits one JSON entry per event containing a W3C Trace-Context `traceparent` (`00-{trace-id(32 hex)}-{span-id(16 hex)}-{flags(2 hex)}`) plus a per-logger `correlationId` (UUID). This allows downstream collectors to join logs, spans and metrics without any external dependency.

The approach is a self-contained logger: it owns severity ordering, deterministic sampling of high-throughput TRACE/DEBUG paths, child-span derivation for nested operations, and round-trip parsing/formatting of the `traceparent` header. `EosStructuredLogger`, `parseTraceparent` and `formatTraceparent` are the exported surface, and the engine is intentionally dependency-free to satisfy Ley V.

## 2. Functional Requirements (EARS Syntax)

- **FR-561 (Ubiquitous - Structured JSON Log Emission)**: The system shall emit each accepted log event as a single JSON-serialized `LogEntry` object containing `timestamp`, `level`, `message`, `traceId` (32 hexadecimal characters), `spanId` (16 hexadecimal characters), `parentSpanId`, `correlationId` (a 36-character UUID), `module` and `metadata`.
- **FR-562 (Event-Driven - W3C Traceparent Parsing and Formatting)**: When a `traceparent` header is supplied to `parseTraceparent`, the system shall return a `TraceContext` only if the header has exactly four dash-separated parts, version `"00"`, a 32-hex `traceId` and a 16-hex `spanId`; otherwise it shall return `null`, and `formatTraceparent` shall reproduce the original header from a parsed context.
- **FR-563 (State-Driven - Child Span Trace Inheritance)**: While a child span is created through `createChildSpan`, the system shall inherit the parent `traceId`, generate a new distinct `spanId`, and set the child `parentSpanId` equal to the parent span's `spanId`.
- **FR-564 (State-Driven - Severity Threshold Filtering)**: While a logger is configured with a `minLevel`, the system shall discard any event whose severity rank (TRACE=0, DEBUG=1, INFO=2, WARN=3, ERROR=4, FATAL=5) is lower than the configured `minLevel` rank.
- **FR-565 (Event-Driven - Deterministic Sampling of Verbose Levels)**: When a TRACE or DEBUG event is emitted, the system shall apply the configured `sampleRate` so that verbose entries are suppressed probabilistically without affecting INFO and above.
- **FR-566 (Event-Driven - Timed Operation Instrumentation)**: When `timed()` wraps an asynchronous or synchronous operation, the system shall return the operation result, emit an entry carrying a non-negative `metadata.durationMs`, and on failure emit an error-level entry with status `"error"` before rethrowing.

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-561 Structured entry carries trace, span and correlation identifiers
  GIVEN a logger configured with moduleName "test", minLevel "TRACE" and sampleRate 1
  WHEN a call to info("hello", { key: "val" }) is made
  THEN exactly one JSON line is produced
  AND its message equals "hello", its traceId length is 32 and its spanId length is 16
  AND its correlationId length is 36, its module equals "test" and its metadata equals { key: "val" }
```

```gherkin
SCENARIO: BDD-562 Child span inherits the trace and opens a new span
  GIVEN a parent logger and a child logger obtained via createChildSpan()
  WHEN the trace contexts of both loggers are read
  THEN the child traceId equals the parent traceId
  AND the child spanId differs from the parent spanId
  AND the child parentSpanId equals the parent spanId
```

```gherkin
SCENARIO: BDD-563 Traceparent round-trips through parse and format
  GIVEN the header "00-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-deadbeefdeadbeef-01"
  WHEN the header is parsed with parseTraceparent and the context is reformatted
  THEN the parsed context is non-null and its traceId equals "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
  AND formatTraceparent reproduces the original header exactly
```

```gherkin
SCENARIO: BDD-564 Minimum level filtering and timed durations
  GIVEN a logger configured with minLevel "WARN" and a second logger configured with minLevel "TRACE"
  WHEN debug, info and warn are emitted on the first logger and a timed() call returning 42 is made on the second
  THEN the first logger produces exactly one line (the warn entry)
  AND the timed() result equals 42 and its logged metadata.durationMs is greater than or equal to 0
```

## 4. Architecture Decision Records (ADRs)

- **ADR-147-1: JSON-log lines with embedded W3C Trace-Context**

  - _Context_: Correlating logs across modules and async boundaries is impossible with free-text output, and the EOS Layer-0 mandate forbids external logging dependencies.
  - _Decision_: Emit one JSON `LogEntry` per event carrying a W3C `traceparent`-compatible `traceId`/`spanId` and a UUID `correlationId`, implemented with only `node:crypto` and kernel primitives.
  - _Consequence_: Downstream collectors gain join keys for logs, spans and metrics at the cost of slightly larger log lines and a fixed 32/16/36-character identifier contract.

- **ADR-147-2: Severity threshold plus probabilistic sampling for verbose levels**
  - _Context_: High-throughput paths can flood storage if every TRACE/DEBUG line is persisted, yet these levels remain valuable for targeted diagnosis.
  - _Decision_: Apply a `LEVEL_ORDER` threshold and let `sampleRate` gate only TRACE and DEBUG emissions.
  - _Consequence_: INFO and above are always preserved while verbose traffic is bounded deterministically by configuration.

## 5. Atomic Task DAG

1. [x] **TASK-147-1**: Author this specification defining FR-561..FR-566 and BDD-561..BDD-564 for the structured logging contract.
2. [x] **TASK-147-2**: Implement `src/core/eosStructuredLogger.ts` with `EosStructuredLogger`, `parseTraceparent` and `formatTraceparent` as specified.
3. [x] **TASK-147-3**: Implement BDD tests `BDD-460`..`BDD-464` in `test/eosBigTechObservability.test.mjs` (`describe("SPEC-147: ...")`).
