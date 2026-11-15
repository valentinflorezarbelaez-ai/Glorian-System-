# CHANGE-140: OpenTelemetry Distributed Tracing & High-Throughput OTLP Collector Gateway (SPEC-278)

## 1. Metadata

- **Change ID**: `CHANGE-140`
- **Specification ID**: `SPEC-278`
- **Domain**: Cloud Observability, Distributed Tracing & High-Throughput OTLP Ingestion
- **Status**: `PROPOSED`
- **Target Release**: `v76.0.0`
- **Author**: Glorian Control Plane Core Team

## 2. Intent & Scope

Introduces enterprise-grade OpenTelemetry distributed tracing and high-throughput OTLP ingestion gateway:

- Memory-bounded zero-allocation circular buffer for high-throughput span ingestion without Node.js GC latency inflation.
- Intelligent Tail-Based Trace Sampling preserving 100% of error traces (`status.code === 2` or `http.status_code >= 500`) and latency tail outliers (> 250ms), while uniformly down-sampling nominal happy-path traffic (default 5%).
- Trace latency percentile calculator generating P50, P90, P95, and P99 metrics across distributed service traces.
- Deterministic trace serialization, span querying, and cryptographic receipt generation sealed with SHA-256.
- CLI commands: `toolchain:otel:ingest`, `toolchain:otel:spans`, `toolchain:otel:stats`.

## 3. Invariants Preserved

- `dependencies: {}` maintained (pure Layer-0 TypeScript).
- Exactly 12/12 serverless functions in `/api/`.
- All modules strictly $\le 750$ lines.
- Cryptographic SHA-256 verifiable receipts in `docs/evidence/OTEL_RECEIPT.json`.
