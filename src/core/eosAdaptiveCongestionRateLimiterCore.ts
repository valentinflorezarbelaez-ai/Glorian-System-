/**
 * EOS SYSTEM — LAYER-0 ADAPTIVE AIMD CONGESTION CONTROL RATE LIMITER (SPEC-228)
 *
 * Closed-loop latency-aware rate limiting combining:
 * 1. Token Bucket (burst capacity + continuous refill)
 * 2. AIMD Congestion Window (TCP-inspired cwnd bounding in-flight concurrency)
 * 3. Sliding HDR Histogram (1024 exponential buckets, amortised O(1) P99 estimation)
 *
 * Zero external runtime dependencies. Layer-0 Pure TypeScript.
 */

import type {
  AdaptiveCongestionConfig,
  AdmissionDecision,
  AdmissionResult,
  RateLimiterStats,
} from "./eosAdaptiveCongestionRateLimiterCore.types.ts";

/**
 * High Dynamic Range (HDR) Histogram with sliding window sample eviction.
 * Uses 1024 logarithmically-scaled buckets covering latencies up to 65,535 ms.
 */
export class SlidingHdrHistogram {
  private static readonly BUCKET_COUNT = 1024;
  private readonly buckets: Uint32Array = new Uint32Array(SlidingHdrHistogram.BUCKET_COUNT);
  private readonly timestamps: Float64Array;
  private readonly bucketIndices: Uint16Array;
  private readonly maxRingSamples: number;
  private readonly windowMs: number;

  private head = 0;
  private tail = 0;
  private ringSize = 0;
  private totalSamples = 0;

  constructor(windowMs = 10000, maxRingSamples = 65536) {
    this.windowMs = Math.max(100, windowMs);
    this.maxRingSamples = Math.max(256, maxRingSamples);
    this.timestamps = new Float64Array(this.maxRingSamples);
    this.bucketIndices = new Uint16Array(this.maxRingSamples);
  }

  static bucketIndex(ms: number): number {
    if (ms <= 0) return 0;
    const idx = Math.floor(Math.log2(ms + 1) * 128);
    return Math.min(SlidingHdrHistogram.BUCKET_COUNT - 1, Math.max(0, idx));
  }

  static bucketToMs(idx: number): number {
    if (idx <= 0) return 0;
    return Math.max(0, Math.pow(2, (idx + 0.5) / 128) - 1);
  }

  record(latencyMs: number, now: number = Date.now()): void {
    this.evict(now);

    const safeLatency = Math.max(0, latencyMs);
    const bucketIdx = SlidingHdrHistogram.bucketIndex(safeLatency);

    // If ring is full, evict oldest element first
    if (this.ringSize >= this.maxRingSamples) {
      const oldBucket = this.bucketIndices[this.tail];
      if (this.buckets[oldBucket] > 0) {
        this.buckets[oldBucket]--;
        this.totalSamples--;
      }
      this.tail = (this.tail + 1) % this.maxRingSamples;
      this.ringSize--;
    }

    // Insert new sample
    this.timestamps[this.head] = now;
    this.bucketIndices[this.head] = bucketIdx;
    this.buckets[bucketIdx]++;
    this.totalSamples++;

    this.head = (this.head + 1) % this.maxRingSamples;
    this.ringSize++;
  }

  getP99(now: number = Date.now()): number {
    this.evict(now);
    if (this.totalSamples === 0) return 0;

    const target = Math.ceil(this.totalSamples * 0.99);
    let cumulative = 0;

    for (let i = 0; i < SlidingHdrHistogram.BUCKET_COUNT; i++) {
      cumulative += this.buckets[i];
      if (cumulative >= target) {
        return SlidingHdrHistogram.bucketToMs(i);
      }
    }

    return SlidingHdrHistogram.bucketToMs(SlidingHdrHistogram.BUCKET_COUNT - 1);
  }

  evict(now: number): void {
    while (this.ringSize > 0) {
      const sampleAge = now - this.timestamps[this.tail];
      if (sampleAge <= this.windowMs) break;

      const oldBucket = this.bucketIndices[this.tail];
      if (this.buckets[oldBucket] > 0) {
        this.buckets[oldBucket]--;
        this.totalSamples--;
      }
      this.tail = (this.tail + 1) % this.maxRingSamples;
      this.ringSize--;
    }
  }

  getSampleCount(now: number = Date.now()): number {
    this.evict(now);
    return this.totalSamples;
  }

  reset(): void {
    this.buckets.fill(0);
    this.timestamps.fill(0);
    this.bucketIndices.fill(0);
    this.head = 0;
    this.tail = 0;
    this.ringSize = 0;
    this.totalSamples = 0;
  }
}

/**
 * EosAdaptiveCongestionRateLimiterCore
 *
 * Implements Token Bucket admission with TCP-style AIMD Congestion Window (cwnd)
 * and closed-loop P99 latency feedback.
 */
export class EosAdaptiveCongestionRateLimiterCore {
  readonly capacity: number;
  readonly refillRate: number;
  readonly minCwnd: number;
  readonly maxCwnd: number;
  readonly alpha: number;
  readonly beta: number;
  readonly latencyThresholdMs: number;

  private tokens: number;
  private lastRefillMs: number;
  private cwnd: number;
  private inFlight = 0;

  private totalAdmitted = 0;
  private totalThrottled = 0;
  private totalRejected = 0;
  private totalCompleted = 0;

  private readonly histogram: SlidingHdrHistogram;

  constructor(config: AdaptiveCongestionConfig) {
    if (!config || config.capacity <= 0) {
      throw new Error("AdaptiveCongestionConfig: capacity must be > 0");
    }
    if (config.refillRate <= 0) {
      throw new Error("AdaptiveCongestionConfig: refillRate must be > 0");
    }

    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.minCwnd = Math.max(1, config.minCwnd ?? 1);
    this.maxCwnd = Math.max(this.minCwnd, config.maxCwnd ?? config.capacity * 4);

    const initial = config.initialCwnd ?? config.capacity;
    this.cwnd = Math.min(this.maxCwnd, Math.max(this.minCwnd, initial));

    this.alpha = config.alpha !== undefined && config.alpha > 0 ? config.alpha : 1;
    this.beta = config.beta !== undefined && config.beta > 0 && config.beta < 1 ? config.beta : 0.5;
    this.latencyThresholdMs = Math.max(1, config.latencyThresholdMs ?? 50);

    this.tokens = this.capacity;
    this.lastRefillMs = Date.now();

    this.histogram = new SlidingHdrHistogram(config.windowMs, config.maxRingSamples);
  }

  private refill(now: number): void {
    const elapsedSec = (now - this.lastRefillMs) / 1000.0;
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillRate);
      this.lastRefillMs = now;
    }
  }

  /**
   * Evaluates admission for an incoming request.
   * - REJECT: Token bucket empty (< 1 token available).
   * - THROTTLE: Congestion window saturated (inFlight >= cwnd).
   * - ADMIT: Tokens available and inFlight < cwnd. Consumes 1 token, increments inFlight.
   */
  admit(now: number = Date.now()): AdmissionResult {
    this.refill(now);

    // Rule 1: Token bucket exhaustion
    if (this.tokens < 1) {
      this.totalRejected++;
      return {
        decision: "REJECT",
        allowed: false,
        reason: "TOKEN_BUCKET_EXHAUSTED",
        cwnd: this.cwnd,
        inFlight: this.inFlight,
        availableTokens: Math.floor(this.tokens),
      };
    }

    // Rule 2: Congestion window saturation
    if (this.inFlight >= this.cwnd) {
      this.totalThrottled++;
      return {
        decision: "THROTTLE",
        allowed: false,
        reason: "CONGESTION_WINDOW_FULL",
        cwnd: this.cwnd,
        inFlight: this.inFlight,
        availableTokens: Math.floor(this.tokens),
      };
    }

    // Rule 3: Admission granted
    this.tokens -= 1;
    this.inFlight += 1;
    this.totalAdmitted++;

    return {
      decision: "ADMIT",
      allowed: true,
      cwnd: this.cwnd,
      inFlight: this.inFlight,
      availableTokens: Math.floor(this.tokens),
    };
  }

  /**
   * Reports completion of an in-flight request with its observed latency in ms.
   * Decrements in-flight count, records latency into HDR histogram, and applies AIMD cwnd adjustment.
   */
  complete(latencyMs: number, now: number = Date.now()): void {
    if (this.inFlight > 0) {
      this.inFlight -= 1;
    }
    this.totalCompleted++;

    this.histogram.record(latencyMs, now);
    const p99 = this.histogram.getP99(now);

    if (p99 >= this.latencyThresholdMs) {
      // Multiplicative Decrease
      this.cwnd = Math.max(this.minCwnd, Math.floor(this.cwnd * this.beta));
    } else {
      // Additive Increase
      this.cwnd = Math.min(this.maxCwnd, this.cwnd + this.alpha);
    }
  }

  /**
   * Returns current snapshot statistics.
   */
  stats(now: number = Date.now()): RateLimiterStats {
    this.refill(now);
    const p99 = this.histogram.getP99(now);

    return {
      capacity: this.capacity,
      availableTokens: Math.floor(this.tokens),
      refillRate: this.refillRate,
      cwnd: this.cwnd,
      inFlight: this.inFlight,
      minCwnd: this.minCwnd,
      maxCwnd: this.maxCwnd,
      alpha: this.alpha,
      beta: this.beta,
      latencyThresholdMs: this.latencyThresholdMs,
      p99LatencyMs: Math.round(p99 * 100) / 100,
      sampleCount: this.histogram.getSampleCount(now),
      totalAdmitted: this.totalAdmitted,
      totalThrottled: this.totalThrottled,
      totalRejected: this.totalRejected,
      totalCompleted: this.totalCompleted,
    };
  }

  /**
   * Resets rate limiter state to initial configuration.
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillMs = Date.now();
    this.cwnd = Math.min(this.maxCwnd, Math.max(this.minCwnd, this.capacity));
    this.inFlight = 0;
    this.totalAdmitted = 0;
    this.totalThrottled = 0;
    this.totalRejected = 0;
    this.totalCompleted = 0;
    this.histogram.reset();
  }
}
