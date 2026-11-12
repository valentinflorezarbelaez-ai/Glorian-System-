/**
 * EOS SYSTEM — LAYER-0 ADAPTIVE AIMD CONGESTION CONTROL RATE LIMITER (SPEC-228)
 * Type Definitions & Interfaces
 *
 * Closed-loop latency-aware rate limiting with Token Bucket + TCP AIMD Congestion Window
 * and sliding-window HDR histogram P99 latency estimator.
 *
 * Zero external runtime dependencies.
 */

export type AdmissionDecision = "ADMIT" | "THROTTLE" | "REJECT";

export interface AdaptiveCongestionConfig {
  /** Maximum token bucket capacity (burst limit) */
  readonly capacity: number;
  /** Token refill rate per second */
  readonly refillRate: number;
  /** Initial congestion window (defaults to capacity) */
  readonly initialCwnd?: number;
  /** Minimum congestion window floor (defaults to 1) */
  readonly minCwnd?: number;
  /** Maximum congestion window ceiling (defaults to capacity * 4) */
  readonly maxCwnd?: number;
  /** Additive increase step per successful sample under threshold (defaults to 1) */
  readonly alpha?: number;
  /** Multiplicative decrease factor when P99 >= threshold (0 < beta < 1, defaults to 0.5) */
  readonly beta?: number;
  /** P99 latency threshold in milliseconds to trigger congestion backoff (defaults to 50) */
  readonly latencyThresholdMs?: number;
  /** Sliding window duration for P99 latency calculation in milliseconds (defaults to 10000) */
  readonly windowMs?: number;
  /** Maximum number of samples retained in the sliding ring buffer (defaults to 65536) */
  readonly maxRingSamples?: number;
}

export interface AdmissionResult {
  readonly decision: AdmissionDecision;
  readonly allowed: boolean;
  readonly reason?: string;
  readonly cwnd: number;
  readonly inFlight: number;
  readonly availableTokens: number;
}

export interface RateLimiterStats {
  readonly capacity: number;
  readonly availableTokens: number;
  readonly refillRate: number;
  readonly cwnd: number;
  readonly inFlight: number;
  readonly minCwnd: number;
  readonly maxCwnd: number;
  readonly alpha: number;
  readonly beta: number;
  readonly latencyThresholdMs: number;
  readonly p99LatencyMs: number;
  readonly sampleCount: number;
  readonly totalAdmitted: number;
  readonly totalThrottled: number;
  readonly totalRejected: number;
  readonly totalCompleted: number;
}
