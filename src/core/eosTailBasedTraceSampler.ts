/**
 * EOS Dynamic Tail-Based Distributed Trace Sampler (SPEC-113)
 *
 * Implements the Google Dapper / Honeycomb tail-sampling doctrine:
 * 1. Post-execution span aggregation and in-memory trace buffering.
 * 2. 100% deterministic sampling of error traces (HTTP 5xx, uncaught panics).
 * 3. 100% deterministic sampling of tail latency stragglers (> LatencyThresholdMs).
 * 4. 100% deterministic sampling of resilience interventions (hedges, load-shedding, circuit breaker trips).
 * 5. Low nominal baseline sampling for nominal healthy traces (e.g. 0.1%).
 * 6. Memory-safe TTL buffer sweep and eviction of abandoned traces.
 * 7. Cryptographic SHA-256 verifiable trace sampling receipts.
 *
 * Layer 0 Purity: Zero runtime npm dependencies.
 */

import { createHash } from "node:crypto";

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

interface InternalTraceBuffer {
  readonly traceId: string;
  readonly spans: TraceSpan[];
  readonly createdAtMs: number;
  lastActivityMs: number;
}

export class EosTailBasedTraceSampler {
  private readonly latencyThresholdMs: number;
  private readonly nominalSampleRate: number;
  private readonly maxActiveTraces: number;
  private readonly retentionWindowMs: number;

  private readonly buffers = new Map<string, InternalTraceBuffer>();

  private totalSpansRecorded = 0;
  private tracesEvaluated = 0;
  private tracesSampled = 0;
  private tracesDropped = 0;
  private tracesEvicted = 0;

  private readonly sampledByReason: Record<SamplingDecisionReason, number> = {
    SAMPLE_REASON_ERROR: 0,
    SAMPLE_REASON_HIGH_LATENCY: 0,
    SAMPLE_REASON_RESILIENCE_EVENT: 0,
    SAMPLE_REASON_NOMINAL_SAMPLE: 0,
    DROPPED_NOMINAL_TRACE: 0,
    EVICTED_TTL_EXPIRED: 0,
  };

  constructor(config: TailSamplerConfig = {}) {
    this.latencyThresholdMs = config.latencyThresholdMs ?? 500;
    this.nominalSampleRate = config.nominalSampleRate ?? 0.001;
    this.maxActiveTraces = config.maxActiveTraces ?? 10_000;
    this.retentionWindowMs = config.retentionWindowMs ?? 60_000;
  }

  /**
   * Ingests a span into the in-flight trace buffer.
   * Evicts the oldest trace if max active trace capacity is reached.
   */
  public recordSpan(span: TraceSpan): { activeSpansInTrace: number } {
    const now = Date.now();
    this.totalSpansRecorded++;

    let buffer = this.buffers.get(span.traceId);
    if (!buffer) {
      if (this.buffers.size >= this.maxActiveTraces) {
        this.evictOldestTrace();
      }
      buffer = {
        traceId: span.traceId,
        spans: [],
        createdAtMs: now,
        lastActivityMs: now,
      };
      this.buffers.set(span.traceId, buffer);
    }

    buffer.spans.push(span);
    buffer.lastActivityMs = now;

    return { activeSpansInTrace: buffer.spans.length };
  }

  /**
   * Evaluates the completed trace and makes a definitive sampling decision.
   * Flushes the trace buffer upon decision.
   */
  public evaluateTrace(
    traceId: string,
    options: { forceSample?: boolean } = {}
  ): TraceSamplingDecision {
    const buffer = this.buffers.get(traceId);
    const now = Date.now();

    if (!buffer || buffer.spans.length === 0) {
      const receipt = createHash("sha256")
        .update(`TRACE_EMPTY:${traceId}:${now}`)
        .digest("hex");
      return {
        traceId,
        sampled: false,
        reason: "DROPPED_NOMINAL_TRACE",
        spanCount: 0,
        totalDurationMs: 0,
        evaluatedAtMs: now,
        sha256Receipt: receipt,
      };
    }

    this.buffers.delete(traceId);
    this.tracesEvaluated++;

    const spans = buffer.spans;
    const spanCount = spans.length;

    // Calculate total trace duration from spans
    let minStart = spans[0].startTimeMs;
    let maxEnd = spans[0].startTimeMs + spans[0].durationMs;
    for (let i = 1; i < spans.length; i++) {
      const s = spans[i];
      if (s.startTimeMs < minStart) minStart = s.startTimeMs;
      const end = s.startTimeMs + s.durationMs;
      if (end > maxEnd) maxEnd = end;
    }
    const totalDurationMs = Math.max(0, maxEnd - minStart);

    // Rule 1: Check for explicit errors (HTTP 5xx, hasError flag)
    const hasError = spans.some(
      (s) => s.hasError === true || (s.statusCode !== undefined && s.statusCode >= 500)
    );

    // Rule 2: Check for tail latency SLA breach
    const hasHighLatency = totalDurationMs > this.latencyThresholdMs;

    // Rule 3: Check for resilience events (hedging, circuit breaker, load-shedding)
    const hasResilienceEvent = spans.some((s) => s.isResilienceEvent === true);

    let sampled = false;
    let reason: SamplingDecisionReason;

    if (options.forceSample) {
      sampled = true;
      reason = "SAMPLE_REASON_NOMINAL_SAMPLE";
    } else if (hasError) {
      sampled = true;
      reason = "SAMPLE_REASON_ERROR";
    } else if (hasHighLatency) {
      sampled = true;
      reason = "SAMPLE_REASON_HIGH_LATENCY";
    } else if (hasResilienceEvent) {
      sampled = true;
      reason = "SAMPLE_REASON_RESILIENCE_EVENT";
    } else {
      // Rule 4: Nominal baseline sampling
      sampled = this.evaluateNominalSample(traceId);
      reason = sampled ? "SAMPLE_REASON_NOMINAL_SAMPLE" : "DROPPED_NOMINAL_TRACE";
    }

    if (sampled) {
      this.tracesSampled++;
    } else {
      this.tracesDropped++;
    }

    this.sampledByReason[reason]++;

    const receipt = createHash("sha256")
      .update(`${traceId}:${sampled}:${reason}:${spanCount}:${totalDurationMs}:${now}`)
      .digest("hex");

    return {
      traceId,
      sampled,
      reason,
      spanCount,
      totalDurationMs,
      evaluatedAtMs: now,
      sha256Receipt: receipt,
    };
  }

  /**
   * Helper combining span recording and conditional trace completion evaluation.
   */
  public recordAndEvaluate(
    span: TraceSpan,
    isEndSpan: boolean = false
  ): { spanRecorded: boolean; decision?: TraceSamplingDecision } {
    this.recordSpan(span);
    if (isEndSpan) {
      const decision = this.evaluateTrace(span.traceId);
      return { spanRecorded: true, decision };
    }
    return { spanRecorded: true };
  }

  /**
   * Sweeps and evicts idle traces exceeding the retention window.
   */
  public evictStaleTraces(maxIdleMs?: number): number {
    const threshold = maxIdleMs ?? this.retentionWindowMs;
    const now = Date.now();
    let evicted = 0;

    for (const [traceId, buffer] of this.buffers.entries()) {
      if (now - buffer.lastActivityMs > threshold) {
        this.buffers.delete(traceId);
        this.tracesEvicted++;
        this.sampledByReason.EVICTED_TTL_EXPIRED++;
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Returns complete telemetry and status metrics.
   */
  public getStatus(): TailSamplerStatus {
    const receipt = createHash("sha256")
      .update(
        `STATUS:${this.buffers.size}:${this.totalSpansRecorded}:${this.tracesEvaluated}:${this.tracesSampled}:${this.tracesDropped}:${this.tracesEvicted}`
      )
      .digest("hex");

    return {
      activeTraces: this.buffers.size,
      totalSpansRecorded: this.totalSpansRecorded,
      tracesEvaluated: this.tracesEvaluated,
      tracesSampled: this.tracesSampled,
      tracesDropped: this.tracesDropped,
      tracesEvicted: this.tracesEvicted,
      sampledByReason: { ...this.sampledByReason },
      sha256Receipt: receipt,
    };
  }

  /**
   * Clears state for testing or restart.
   */
  public reset(): void {
    this.buffers.clear();
    this.totalSpansRecorded = 0;
    this.tracesEvaluated = 0;
    this.tracesSampled = 0;
    this.tracesDropped = 0;
    this.tracesEvicted = 0;
    for (const key of Object.keys(this.sampledByReason) as SamplingDecisionReason[]) {
      this.sampledByReason[key] = 0;
    }
  }

  /**
   * Evaluates nominal sampling rate deterministically using traceId hash modulo.
   */
  private evaluateNominalSample(traceId: string): boolean {
    if (this.nominalSampleRate <= 0) return false;
    if (this.nominalSampleRate >= 1.0) return true;

    const hash = createHash("sha256").update(traceId).digest();
    // Read 32-bit unsigned int from the hash
    const val = hash.readUInt32BE(0);
    const normalized = val / 0xffffffff;
    return normalized < this.nominalSampleRate;
  }

  /**
   * Evicts the oldest buffer when the map is full.
   */
  private evictOldestTrace(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, buf] of this.buffers.entries()) {
      if (buf.createdAtMs < oldestTime) {
        oldestTime = buf.createdAtMs;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.buffers.delete(oldestId);
      this.tracesEvicted++;
      this.sampledByReason.EVICTED_TTL_EXPIRED++;
    }
  }
}
