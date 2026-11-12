# CHANGE-111: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine

## 1. Change Metadata

- **Change ID**: `CHANGE-111`
- **Spec ID**: `SPEC-226`
- **Author**: `user:valentin-florez-arbelaez`
- **Reviewers**: `Constitutional-Tribunal`, `EOS-Director`
- **Target Subsystem**: `src/core/eosOtlpDistributedTracingCore.ts`
- **Status**: `PROPOSED`

## 2. Motivation

Equip Glorian System with a canonical, pure Layer-0 OpenTelemetry Distributed Tracing core that formats and parses W3C TraceContext headers, manages hierarchical active spans with monotonic nanosecond timestamps, and serializes trace batches into standard OTLP/HTTP JSON wire format with zero external dependencies.

## 3. Scope of Work

- Create `src/core/eosOtlpDistributedTracingCore.types.ts` ($\le 800$ lines).
- Create `src/core/eosOtlpDistributedTracingCore.ts` ($\le 800$ lines) with:
  - W3C `traceparent` generator and parser (`00-{traceId}-{spanId}-{traceFlags}`).
  - Hierarchical span builder with `startSpan`, `endSpan`, status codes (`UNSET`, `OK`, `ERROR`), and typed attributes.
  - Bounded ring buffer accumulator with capacity bounding and overflow count tracking.
  - Serialization engine generating standard OpenTelemetry `v1/traces` JSON (`ResourceSpans`, `ScopeSpans`, `Span`).
  - Cryptographic attestation digest (SHA-256) over serialized trace payloads.
- Subpath exports `"./otlp"` and `"./trace"` in `package.json`.
- Export from `src/core/index.ts`.
- Add Facade actions `otlp_trace_create`, `otlp_trace_span`, `otlp_trace_export` in `src/core/eosEnterpriseFacade.ts`.
- CLI commands `trace:demo`, `trace:export` in `bin/commands/cliPlatform.mjs`.
- MCP actions in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
- Test suite `test/eosOtlpDistributedTracingCore.test.mjs` verifying BDD-1149..BDD-1153.
- Facade step #38 in `test/eosEnterpriseFacade.test.mjs`.
- Update `docs/DEVELOPER_GUIDE.md`, `docs/specs/openspec-catalog-index.json`.
