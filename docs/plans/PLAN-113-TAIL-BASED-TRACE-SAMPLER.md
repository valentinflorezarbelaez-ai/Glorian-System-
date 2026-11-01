# PLAN-113: Dynamic Tail-Based Distributed Trace Sampler

## 1. Architecture Decision Record (ADR-113)

### Context
Head-based trace sampling makes an irrevocable sampling decision when the root span begins, typically retaining 0.1% to 1% of total traffic. However, anomalous system events—such as unexpected database crashes, downstream timeout cascades, uncaught exceptions, and long tail latencies ($P99 > 2000\text{ms}$)—predominantly happen deep within call hierarchies and cannot be anticipated at the root span's start. Consequently, head-based sampling drops the vast majority of critical failure traces while retaining millions of redundant 5ms healthy traces.

Tail-based sampling defers the retention decision until the trace completes its lifecycle (or reaches an idle deadline). By evaluating all aggregated child spans of the trace, the sampler deterministically selects 100% of error traces and latency anomalies, while using low nominal sampling for ordinary traffic.

### Decision
Implement `EosTailBasedTraceSampler` in pure TypeScript Layer 0:
1. **In-Flight Span Buffer Ring**: Accumulate spans in an in-memory map keyed by `traceId`, storing span ID, parent ID, timestamps, status code, error flags, duration, and attributes.
2. **Deterministic Evaluation Rules**:
   - `SAMPLE_REASON_ERROR`: Any span with `hasError === true` or `statusCode >= 500`.
   - `SAMPLE_REASON_HIGH_LATENCY`: Total trace duration exceeds `latencyThresholdMs` (default: 500ms).
   - `SAMPLE_REASON_RESILIENCE_EVENT`: Any span marked as hedged, fallback, or load-shed.
   - `SAMPLE_REASON_NOMINAL_SAMPLE`: Deterministic pseudo-random or counter-based sampling at `nominalSampleRate` (default: 0.001 / 0.1%).
   - `DROPPED_NOMINAL_TRACE`: Dropped healthy traces with immediate memory release.
3. **Bounded Memory & Ring Buffer Eviction**:
   - Track trace creation timestamp.
   - Automatic sweep and purge of orphaned traces older than `retentionWindowMs` (default: 60,000ms) with `EVICTED_TTL_EXPIRED`.
   - Max active traces cap (`maxActiveTraces`, default: 10,000) with LRU/oldest eviction.
4. **Cryptographic Verification**: Generate a SHA-256 receipt for each sampling decision.

### Rejected Alternatives
* **Alternative A: Upstream Head-Based Sampling (OpenTelemetry SDK standard default)**
  * *Why Rejected*: High failure blindness. Misses rare, mission-critical errors and tail latency regressions that occur after span creation.
* **Alternative B: Retaining 100% of All Distributed Traces to Disk**
  * *Why Rejected*: Prohibitive storage and network costs at scale. In a 50,000 req/sec cluster, uncompressed trace ingestion overwhelms storage infrastructure.
* **Alternative C: External OpenTelemetry Collector Daemon Dependency**
  * *Why Rejected*: Violates EOS Law V (Architectural Purity) and Law IV (Layer 0 Purity) by requiring external runtime collectors and network daemons for basic sampling decisions.

---

## 2. Data Contracts & Interfaces

```typescript
export interface TraceSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly startTimeMs: number;
  readonly durationMs: number;
  readonly statusCode?: number;
  readonly hasError?: boolean;
  readonly isResilienceEvent?: boolean;
  readonly attributes?: Record<string, string | number | boolean>;
}

export type SamplingDecisionReason =
  | "SAMPLE_REASON_ERROR"
  | "SAMPLE_REASON_HIGH_LATENCY"
  | "SAMPLE_REASON_RESILIENCE_EVENT"
  | "SAMPLE_REASON_NOMINAL_SAMPLE"
  | "DROPPED_NOMINAL_TRACE"
  | "EVICTED_TTL_EXPIRED";

export interface TraceSamplingDecision {
  readonly traceId: string;
  readonly sampled: boolean;
  readonly reason: SamplingDecisionReason;
  readonly spanCount: number;
  readonly totalDurationMs: number;
  readonly evaluatedAtMs: number;
  readonly sha256Receipt: string;
}

export interface TailSamplerConfig {
  readonly latencyThresholdMs?: number;   // default: 500ms
  readonly nominalSampleRate?: number;    // default: 0.001 (0.1%)
  readonly maxActiveTraces?: number;      // default: 10,000
  readonly retentionWindowMs?: number;    // default: 60,000ms
}

export interface TailSamplerStatus {
  readonly activeTraces: number;
  readonly totalSpansRecorded: number;
  readonly tracesEvaluated: number;
  readonly tracesSampled: number;
  readonly tracesDropped: number;
  readonly tracesEvicted: number;
  readonly sampledByReason: Record<SamplingDecisionReason, number>;
  readonly sha256Receipt: string;
}
```

---

## 3. Integration Points
* **Layer 0 Core**: `src/core/eosTailBasedTraceSampler.ts`, exported in `src/core/index.ts`.
* **MCP Server**: Registered in `src/mcp/eosMcpServer.ts` and `docs/contracts/mcp-tool-catalog.json`.
  - Tool 1: `eos_trace_span_record` (records a span and optionally triggers completion evaluation).
  - Tool 2: `eos_trace_sampler_status` (queries sampler metrics, active buffers, and retention statistics).
* **Formal Verification**: `docs/formal/TailBasedTraceSampler.tla` and `scripts/verify-formal-tla.mjs` (Model 33).
