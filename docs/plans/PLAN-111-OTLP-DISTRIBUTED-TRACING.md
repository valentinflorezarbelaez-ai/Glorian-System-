# PLAN-111: Layer-0 High-Throughput OTLP Distributed Tracing & W3C Context Propagation Engine

- **Plan ID**: `PLAN-111`
- **Spec ID**: `SPEC-226`
- **Change ID**: `CHANGE-111`
- **Status**: `APPROVED`
- **Author**: Valentín Flórez Arbeláez (Chief Architect)

## 1. Architectural Strategy

- **Layer-0 Pure Node.js Hexagonal Core**:
  - Implemented strictly within `src/core/eosOtlpDistributedTracingCore.ts` and `src/core/eosOtlpDistributedTracingCore.types.ts`.
  - Zero external npm packages (no `@opentelemetry/api`, no protobufjs).
  - Uses `node:crypto` for cryptographic random bytes and SHA-256 digests.
- **W3C Standards Compliance**:
  - Full compliance with W3C TraceContext Recommendation (traceparent and tracestate parsing and generation).
- **Canonical OpenTelemetry Schema**:
  - Strictly matches OpenTelemetry specification for OTLP/HTTP-JSON `v1/traces`.
- **Rejected Alternatives**:
  - _Alternative A_: Bundling `@opentelemetry/sdk-trace-base`. Rejected due to Law V (zero external runtime dependencies in Layer-0).
  - _Alternative B_: Heavyweight Protocol Buffers binary compilation. Rejected due to portability and build complexity; standard OTLP/HTTP JSON provides universal ingestion with zero native dependencies.

## 2. Invariants & Constraints

1. **Zero External Runtime Dependencies**: `package.json` dependencies remain 0.
2. **Nanosecond Precision**: Monotonic timestamps via `process.hrtime.bigint()`.
3. **Contract Guards**: Public methods guarded by preconditions, postconditions, and deep freeze.
4. **Attestation Integrity**: Every export produces a verifiable SHA-256 receipt.
