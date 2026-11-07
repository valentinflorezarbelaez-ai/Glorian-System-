/**
 * EOS SYSTEM — NETFLIX VEGAS ADAPTIVE CONCURRENCY LIMITER
 * Governed by ADR-041, SPEC-035, FR-101, BDD-092
 *
 * Implements:
 * 1. Dynamic concurrency estimation based on TCP Vegas / Little's Law.
 * 2. Real-time RTT tracking (RTT_min vs RTT_smoothed via EWMA).
 * 3. Queue inflation calculation: queue = limit * (1 - RTT_min / RTT_smoothed).
 * 4. Additive Increase / Multiplicative Decrease (AIMD) gradient adjustment.
 * 5. Proactive fail-safe load-shedding to prevent latency collapse and event loop starvation.
 *
 * 100% Layer-0 Purity with zero runtime npm dependencies.
 */

import crypto from "node:crypto";
import { performance } from "node:perf_hooks";

export interface ConcurrencyLimiterOptions {
  readonly initialLimit?: number;
  readonly minLimit?: number;
  readonly maxLimit?: number;
  readonly alpha?: number; // Queue size threshold for expansion (default 3)
  readonly beta?: number; // Queue size threshold for contraction (default 6)
  readonly smoothingFactor?: number; // EWMA alpha (default 0.2)
}

export interface ConcurrencyMetrics {
  readonly currentLimit: number;
  readonly inFlight: number;
  readonly rttMinMs: number;
  readonly rttSmoothedMs: number;
  readonly estimatedQueueSize: number;
  readonly totalAdmitted: number;
  readonly totalShed: number;
}

export class EosAdaptiveConcurrencyLimiter {
  private limit: number;
  private readonly minLimit: number;
  private readonly maxLimit: number;
  private readonly alpha: number;
  private readonly beta: number;
  private readonly smoothingFactor: number;

  private inFlight = 0;
  private rttMinMs = Infinity;
  private rttSmoothedMs = 0;
  private totalAdmitted = 0;
  private totalShed = 0;

  constructor(options: ConcurrencyLimiterOptions = {}) {
    this.limit = options.initialLimit || 20;
    this.minLimit = options.minLimit || 5;
    this.maxLimit = options.maxLimit || 500;
    this.alpha = options.alpha || 3;
    this.beta = options.beta || 6;
    this.smoothingFactor = options.smoothingFactor || 0.2;
  }

  /**
   * Attempts to acquire execution capacity.
   * Rejects immediately with load-shedding if current inflight count reaches the dynamic limit.
   */
  public acquire(): { granted: boolean; token?: string; reason?: string } {
    if (this.inFlight >= this.limit) {
      this.totalShed++;
      return {
        granted: false,
        reason: "SHED_LOAD_CONCURRENCY_EXCEEDED",
      };
    }

    this.inFlight++;
    this.totalAdmitted++;
    const token = `TKN-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    return {
      granted: true,
      token,
    };
  }

  /**
   * Releases acquired capacity and updates latency-driven limit gradient.
   */
  public release(rttMs: number): void {
    if (this.inFlight > 0) {
      this.inFlight--;
    }

    if (rttMs <= 0) return;

    // Track historical minimum RTT
    if (rttMs < this.rttMinMs) {
      this.rttMinMs = rttMs;
    }

    // Update smoothed RTT with EWMA
    if (this.rttSmoothedMs === 0) {
      this.rttSmoothedMs = rttMs;
    } else {
      this.rttSmoothedMs = this.smoothingFactor * rttMs + (1 - this.smoothingFactor) * this.rttSmoothedMs;
    }

    // Evaluate queue inflation (TCP Vegas gradient)
    if (this.rttMinMs > 0 && this.rttSmoothedMs > 0) {
      const queueInflation = this.limit * (1 - this.rttMinMs / this.rttSmoothedMs);

      if (queueInflation < this.alpha) {
        // Underutilized: expand concurrency capacity
        this.limit = Math.min(this.maxLimit, this.limit + 1);
      } else if (queueInflation > this.beta) {
        // Congestion detected: contract concurrency limit
        const backoff = Math.max(1, Math.floor(queueInflation - this.beta));
        this.limit = Math.max(this.minLimit, this.limit - backoff);
      }
    }
  }

  /**
   * Convenience wrapper to execute a function under adaptive concurrency control.
   */
  public async execute<T>(
    fn: () => Promise<T> | T,
  ): Promise<{ success: boolean; result?: T; reason?: string; rttMs?: number }> {
    const acquireResult = this.acquire();
    if (!acquireResult.granted) {
      return { success: false, reason: acquireResult.reason };
    }

    const start = performance.now();
    try {
      const result = await fn();
      const rttMs = performance.now() - start;
      this.release(rttMs);
      return { success: true, result, rttMs };
    } catch (err: any) {
      const rttMs = performance.now() - start;
      this.release(rttMs);
      return { success: false, reason: String(err), rttMs };
    }
  }

  public getMetrics(): ConcurrencyMetrics {
    const estimatedQueueSize =
      this.rttMinMs !== Infinity && this.rttSmoothedMs > 0
        ? Math.max(0, this.limit * (1 - this.rttMinMs / this.rttSmoothedMs))
        : 0;

    return {
      currentLimit: this.limit,
      inFlight: this.inFlight,
      rttMinMs: this.rttMinMs === Infinity ? 0 : Number(this.rttMinMs.toFixed(3)),
      rttSmoothedMs: Number(this.rttSmoothedMs.toFixed(3)),
      estimatedQueueSize: Number(estimatedQueueSize.toFixed(2)),
      totalAdmitted: this.totalAdmitted,
      totalShed: this.totalShed,
    };
  }

  public formatPrometheusMetrics(): string {
    const m = this.getMetrics();
    return [
      `# HELP eos_concurrency_limit Dynamic adaptive concurrency limit`,
      `# TYPE eos_concurrency_limit gauge`,
      `eos_concurrency_limit ${m.currentLimit}`,
      `# HELP eos_concurrency_inflight Inflight requests currently executing`,
      `# TYPE eos_concurrency_inflight gauge`,
      `eos_concurrency_inflight ${m.inFlight}`,
      `# HELP eos_concurrency_rtt_min Minimum observed RTT in milliseconds`,
      `# TYPE eos_concurrency_rtt_min gauge`,
      `eos_concurrency_rtt_min ${m.rttMinMs}`,
      `# HELP eos_concurrency_rtt_smoothed EWMA smoothed RTT in milliseconds`,
      `# TYPE eos_concurrency_rtt_smoothed gauge`,
      `eos_concurrency_rtt_smoothed ${m.rttSmoothedMs}`,
      `# HELP eos_concurrency_shed_total Total requests rejected due to load-shedding`,
      `# TYPE eos_concurrency_shed_total counter`,
      `eos_concurrency_shed_total ${m.totalShed}`,
    ].join("\n");
  }
}
