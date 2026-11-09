# INTAKE-113: Dynamic Tail-Based Distributed Trace Sampler

## 1. Context & Business Rationale

In modern hyperscale microservices architectures (Google Dapper, Uber Jaeger, Honeycomb, Lightstep, OpenTelemetry), distributed tracing is fundamental for diagnosing anomalies, debugging downstream latencies, and understanding cross-cell interactions.

However, standard distributed tracing systems rely heavily on **head-based sampling** (making an upfront decision at span creation time to sample, e.g., 1% of incoming requests). Head-based sampling suffers from two catastrophic flaws:

1. **Critical Failure Blindness**: Errors (HTTP 5xx, uncaught panics, DB deadlocks) or severe latency anomalies ($P99 > 2000\text{ms}$) that occur deep in the call stack are permanently lost if the initial root request was not randomly selected at the head.
2. **Resource Waste & Data Bloat**: 99.9% of traces captured by naive head-based sampling represent trivial, nominal requests ($P50 < 5\text{ms}$) that completed successfully, resulting in massive egress bandwidth costs and storage bloat without actionable debugging value.

EOS System requires a pure Layer 0, zero-dependency, self-tuning **Dynamic Tail-Based Distributed Trace Sampler** (`EosTailBasedTraceSampler`) adhering to Google Dapper / Honeycomb tail-sampling doctrines:

1. **In-Flight Span Buffer Ring**: Spans for an active trace are accumulated in an in-memory buffer until the trace completes or reaches a bounding timeout.
2. **Post-Execution Rule Engine**:
   - **Error Traces (100% Sampling)**: Any trace encountering an error (`statusCode >= 500`, exception, or error span flag) is guaranteed 100% retention.
   - **Tail Latency Stragglers (100% Sampling)**: Any trace whose total duration exceeds the configurable latency SLA threshold (e.g. $> 500\text{ms}$ or $> P95$) is preserved at 100%.
   - **Resilience Interventions (100% Sampling)**: Any trace containing spans that triggered fallback circuits, adaptive hedges, or priority load-shedding is sampled at 100%.
   - **Nominal Baseline Sampling (0.1% / Configurable)**: Healthy, fast traces are sampled at a low nominal baseline rate to maintain operational visibility while dropping > 99.9% of nominal noise.
3. **Memory Bounding & Eviction**: Stale or orphaned traces that do not finish within a maximum retention window (e.g., 60 seconds) are evicted to ensure zero memory leaks.
4. **Verifiable Cryptographic Receipts**: Each sampling decision generates a SHA-256 verifiable audit receipt.

## 2. Stakeholders & Squads

- **Architect**: Valentin Florez Arbeláez (`user:valentin-florez-arbelaez`)
- **Primary Squad**: EOS Distributed Systems & Observability Core Squad
- **Compliance Tier**: Tier-0 Core Production Infrastructure (Layer 0 Purity)

## 3. Scope & Non-Goals

- **In Scope**:
  - Pure TypeScript Layer 0 implementation (`src/core/eosTailBasedTraceSampler.ts`) with zero runtime npm dependencies.
  - In-memory trace span aggregation ring with O(1) trace lookups.
  - Deterministic tail-sampling rule evaluator (Errors, High Latency, Resilience Events, Nominal Rate).
  - Memory leak prevention via TTL-based span ring eviction.
  - Formal IEEE 830 EARS specifications and BDD acceptance scenarios.
  - Formal TLA+ specification (`TailBasedTraceSampler.tla`) and bounded simulation.
  - MCP server integration (`eos_trace_span_record`, `eos_trace_sampler_status`).
- **Non-Goals**:
  - External OTel collector networking (Layer 0 pure in-memory engine with standard data structures).
  - Disk serialization of span payloads (delegated to WAL/telemetry sinks if needed).

## 4. Acceptance Criteria

- [x] Pure Layer 0 purity (zero runtime npm dependencies).
- [x] 100% sampling guarantees for error traces and tail latency anomalies.
- [x] Dynamic nominal sampling of healthy traces with bounded memory footprint.
- [x] Formal TLA+ specification with bounded safety invariant checks.
- [x] Strict 7-stage pre-commit SecDevOps verification passes with 0 lint errors, 0 secrets, and 100% type safety.
