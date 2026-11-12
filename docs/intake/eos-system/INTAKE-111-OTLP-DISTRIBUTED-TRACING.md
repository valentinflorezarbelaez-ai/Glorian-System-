# INTAKE-111: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine

- **Intake ID**: `INTAKE-111`
- **Spec ID**: `SPEC-226`
- **Change ID**: `CHANGE-111`
- **Target Subsystem**: `src/core/eosOtlpDistributedTracingCore.ts`
- **Author**: Valentín Flórez Arbeláez (Chief Architect & System Owner)
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-11-12

## 1. Problem Statement & Motivation

While Glorian System features OpenMetrics Prometheus text metrics (`CHANGE-072`), cross-fleet agent swarms, MCP tools, and high-concurrency consensus rounds currently lack a unified, zero-dependency W3C TraceContext propagator and canonical OpenTelemetry OTLP/HTTP-JSON span exporter.

To achieve complete Big Tech observability without adding heavyweight npm dependencies (`@opentelemetry/api`, `@opentelemetry/sdk-trace-base`, protobuf compilers), Glorian requires a native, pure TypeScript Layer-0 distributed tracing core.

## 2. Business & Engineering Drivers

1. **W3C TraceContext Interoperability**: Parse and format standard `traceparent` (`00-{trace_id}-{span_id}-{flags}`) and `tracestate` headers across HTTP and MCP boundaries.
2. **Nanosecond Monotonic Precision**: Span timing recorded via `process.hrtime.bigint()` for sub-microsecond latency accounting without clock skew.
3. **Canonical OTLP/HTTP JSON Wire Format**: Serialize span trees into standard `ResourceSpans` / `ScopeSpans` / `Span` schemas directly compatible with Jaeger, Honeycomb, Datadog, Databricks, and Cloudflare Trace Collectors.
4. **Ring Buffer & Zero-Allocation Sympathy**: Bounded in-memory circular buffer with lock-free drops to safeguard memory under bursty workloads.
5. **Layer-0 Architectural Purity**: Zero external runtime dependencies; strictly uses Node.js primitives and Layer-0 contracts.

## 3. Epistemic Posture

- **Current State**: `INTAKE_RECORDED`
- **Target Verification State**: `VERIFIED_WITHIN_TESTED_SCOPE` (Exit code 0 on BDD-1149..BDD-1153).
