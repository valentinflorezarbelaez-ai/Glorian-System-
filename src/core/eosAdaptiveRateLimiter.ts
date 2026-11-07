/**
 * EOS SYSTEM — ADAPTIVE RATE LIMITER (Layer 0)
 * Governed by SPEC-153 (Cloudflare / AWS API Gateway pattern)
 *
 * Dual-strategy rate limiting:
 * 1. Token Bucket — smooth burst allowance with configurable refill rate
 * 2. Sliding Window Log — precise per-client request counting
 *
 * The adaptive component: monitors rejection ratio and auto-tunes the
 * bucket capacity (AIMD — Additive Increase, Multiplicative Decrease)
 * to match downstream capacity without manual tuning.
 *
 * Zero external dependencies.
 */

import { deepFreeze } from "./eosKernelPrimitives.ts";

export interface RateLimiterConfig {
  readonly bucketCapacity: number; // Max tokens (burst)
  readonly refillRatePerSec: number; // Tokens added per second
  readonly windowSizeMs: number; // Sliding window duration
  readonly maxPerWindow: number; // Max requests in window
  readonly adaptive: boolean; // AIMD auto-tuning
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remainingTokens: number;
  readonly retryAfterMs: number;
  readonly currentCapacity: number;
  readonly rejectionRatio: number;
}

export class EosAdaptiveRateLimiter {
  private tokens: number;
  private lastRefillMs: number;
  private readonly windowLog: number[] = []; // timestamps
  private totalRequests = 0;
  private totalRejections = 0;
  private currentCapacity: number;
  private readonly config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.currentCapacity = config.bucketCapacity;
    this.tokens = config.bucketCapacity;
    this.lastRefillMs = Date.now();
  }

  /**
   * Attempts to consume one token for a request.
   * Returns allow/deny with backpressure signal.
   */
  tryAcquire(): RateLimitDecision {
    const now = Date.now();
    this.totalRequests++;
    this.refill(now);
    this.evictWindow(now);

    // Check sliding window limit
    if (this.windowLog.length >= this.config.maxPerWindow) {
      return this.deny(now, "WINDOW");
    }

    // Check token bucket
    if (this.tokens < 1) {
      return this.deny(now, "BUCKET");
    }

    this.tokens -= 1;
    this.windowLog.push(now);

    // AIMD: increase capacity additively when healthy
    if (this.config.adaptive && this.rejectionRatio() < 0.01) {
      this.currentCapacity = Math.min(this.config.bucketCapacity * 4, this.currentCapacity + 1);
    }

    return deepFreeze({
      allowed: true,
      remainingTokens: Math.floor(this.tokens),
      retryAfterMs: 0,
      currentCapacity: Math.floor(this.currentCapacity),
      rejectionRatio: this.rejectionRatio(),
    });
  }

  /**
   * Returns current utilization stats.
   */
  getStats(): { totalRequests: number; totalRejections: number; currentCapacity: number; tokens: number } {
    return {
      totalRequests: this.totalRequests,
      totalRejections: this.totalRejections,
      currentCapacity: Math.floor(this.currentCapacity),
      tokens: Math.floor(this.tokens),
    };
  }

  private deny(now: number, _reason: string): RateLimitDecision {
    this.totalRejections++;
    // AIMD: multiplicative decrease on rejection
    if (this.config.adaptive) {
      this.currentCapacity = Math.max(1, this.currentCapacity * 0.75);
    }
    const msUntilNextToken = this.tokens < 1 ? Math.ceil((1 - this.tokens) / (this.config.refillRatePerSec / 1000)) : 0;
    return deepFreeze({
      allowed: false,
      remainingTokens: 0,
      retryAfterMs: msUntilNextToken,
      currentCapacity: Math.floor(this.currentCapacity),
      rejectionRatio: this.rejectionRatio(),
    });
  }

  private refill(now: number): void {
    const elapsed = (now - this.lastRefillMs) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(this.currentCapacity, this.tokens + elapsed * this.config.refillRatePerSec);
      this.lastRefillMs = now;
    }
  }

  private evictWindow(now: number): void {
    const cutoff = now - this.config.windowSizeMs;
    while (this.windowLog.length > 0 && this.windowLog[0] <= cutoff) {
      this.windowLog.shift();
    }
  }

  private rejectionRatio(): number {
    return this.totalRequests > 0 ? this.totalRejections / this.totalRequests : 0;
  }
}
