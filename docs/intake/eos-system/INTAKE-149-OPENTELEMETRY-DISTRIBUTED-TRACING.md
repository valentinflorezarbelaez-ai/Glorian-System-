# INTAKE-149: Sovereign OpenTelemetry Distributed Tracing & Real-Time Cockpit Observability

- **Intake ID**: `INTAKE-149`
- **Specification ID**: `SPEC-149`
- **Change ID**: `CHANGE-084`
- **Ladder / Gate**: `LADDER-17` / `GATE-17`
- **Owner**: Valentín Flórez Arbeláez
- **Date**: 2026-11-04
- **Status**: `INTAKE_COMPLETE`

## 1. Intent & Context
In accordance with world-class engineering doctrine (Google Dapper / Monarch, Microsoft Azure OpenTelemetry, Palantir Apollo), high-assurance control planes require universal, deterministic distributed tracing as the foundational nervous system before executing complex autonomous or polyglot workloads.

Glorian System currently possesses individual telemetry modules (tail-sampling in SPEC-113, columnar metrics in SPEC-109, canary metrics in SPEC-110), but lacks a unified, canonical **OpenTelemetry OTLP/JSON-compliant Distributed Tracing Engine** operating in Layer-0 purity.

## 2. Core Objectives
1. **W3C Trace Context Propagation**: Full compliance with W3C Trace Context Level 1 (`traceparent` format `00-{traceId}-{spanId}-{flags}`).
2. **Nanosecond-Precision Spans**: 128-bit (32 hex) `traceId`, 64-bit (16 hex) `spanId`, monotonic nanosecond timestamps, attributes, events, links, and status.
3. **Durable SQLite WAL Trace Store**: Persist traces to `data/eos_telemetry.db` in SQLite WAL mode with indexed CTE hierarchy traversal in `< 1ms`.
4. **Automated MCP Instrumentation**: Every MCP tool invocation automatically recorded as a root or child span with parameter metadata and execution outcome.
5. **Hierarchical Trace Waterfall & Bottleneck Analysis**: Compute trace depth, relative offsets, duration percentages, and isolate the critical path bottleneck.
6. **Canonical OTLP/JSON Export**: 100% interoperable with Jaeger, Grafana Tempo, and Honeycomb without external npm dependencies.
7. **Cockpit Integration**: Real-time trace stream and latency visualization in `eosStudioConsole.html`.

## 3. Epistemic Target
`OTEL_DISTRIBUTED_TRACING_VERIFIED_WITHIN_SCOPE`
Zero external npm dependencies (`runtimeDependenciesCount: 0`).
