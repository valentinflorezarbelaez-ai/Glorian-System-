/**
 * EOS SYSTEM — LAYER-0 ADAPTIVE CONCURRENCY CONTROL & PRIORITY LOAD SHEDDER (SPEC-112)
 *
 * Implements Netflix Vegas / Little's Law congestion gradient and CoDel queue
 * delay management for autonomous inflight capacity tuning and multi-tier load shedding.
 *
 * Governed by SPEC-112, PLAN-112, ADR-112.
 * 100% Layer 0 Purity — zero external runtime npm dependencies.
 */

import crypto from "node:crypto";

export type PriorityTier = "CRITICAL" | "HIGH" | "NORMAL" | "BEST_EFFORT";

export interface ConcurrencyGovernorConfig {
  readonly minLimit?: number; // default: 10
  readonly maxLimit?: number; // default: 200
  readonly initialLimit?: number; // default: 50
  readonly queueHeadroom?: number; // beta additive headroom, default: 3
  readonly maxQueueDelayMs?: number; // CoDel bufferbloat threshold, default: 15ms
  readonly emergencyHeadroom?: number; // Reserved capacity for CRITICAL, default: 10
  readonly smoothingAlpha?: number; // EMA alpha, default: 0.2
}

export interface AdmissionDecision {
  readonly admitted: boolean;
  readonly currentLimit: number;
  readonly inFlight: number;
  readonly priority: PriorityTier;
  readonly reason?: string;
  readonly sha256Receipt: string;
}

export interface ConcurrencyGovernorStatus {
  readonly currentLimit: number;
  readonly inFlight: number;
  readonly baselineRttMs: number;
  readonly currentRttMs: number;
  readonly gradient: number;
  readonly totalAdmitted: number;
  readonly totalShed: number;
  readonly shedByTier: Record<PriorityTier, number>;
  readonly sha256Receipt: string;
}

export class EosAdaptiveConcurrencyGovernor {
  private readonly minLimit: number;
  private readonly maxLimit: number;
  private readonly queueHeadroom: number;
  private readonly maxQueueDelayMs: number;
  private readonly emergencyHeadroom: number;
  private readonly smoothingAlpha: number;

  private currentLimit: number;
  private inFlight = 0;
  private baselineRttMs = 0;
  private currentRttMs = 0;
  private totalAdmitted = 0;
  private totalShed = 0;

  private readonly shedByTier: Record<PriorityTier, number> = {
    CRITICAL: 0,
    HIGH: 0,
    NORMAL: 0,
    BEST_EFFORT: 0,
  };

  constructor(config?: ConcurrencyGovernorConfig) {
    this.minLimit = Math.max(2, config?.minLimit ?? 10);
    this.maxLimit = Math.max(this.minLimit + 10, config?.maxLimit ?? 200);
    this.currentLimit = Math.max(this.minLimit, Math.min(this.maxLimit, config?.initialLimit ?? 50));
    this.queueHeadroom = Math.max(1, config?.queueHeadroom ?? 3);
    this.maxQueueDelayMs = Math.max(1, config?.maxQueueDelayMs ?? 15);
    this.emergencyHeadroom = Math.max(1, config?.emergencyHeadroom ?? 10);
    this.smoothingAlpha = Math.min(1.0, Math.max(0.01, config?.smoothingAlpha ?? 0.2));
  }

  /**
   * Attempts to acquire an execution slot under Vegas gradient and priority rules.
   */
  public tryAcquire(priority: PriorityTier = "NORMAL", queueWaitMs = 0): AdmissionDecision {
    // 1. CoDel Queue Delay Check (Bufferbloat Prevention)
    if (queueWaitMs > this.maxQueueDelayMs) {
      this.totalShed++;
      this.shedByTier[priority]++;
      return this.buildDecision(
        false,
        priority,
        `QUEUE_DELAY_EXCEEDED: Wait time ${queueWaitMs}ms exceeded threshold ${this.maxQueueDelayMs}ms`,
      );
    }

    // 2. Priority-Tier Headroom Gate
    let admitted = false;
    let reason: string | undefined;

    switch (priority) {
      case "BEST_EFFORT": {
        // Shed early when load reaches 80% of current limit
        const threshold = Math.floor(this.currentLimit * 0.8);
        if (this.inFlight < threshold) {
          admitted = true;
        } else {
          reason = `SHED_BEST_EFFORT: In-flight ${this.inFlight} exceeds 80% threshold ${threshold}`;
        }
        break;
      }

      case "NORMAL": {
        // Shed when load reaches 95% of current limit
        const threshold = Math.floor(this.currentLimit * 0.95);
        if (this.inFlight < threshold) {
          admitted = true;
        } else {
          reason = `SHED_NORMAL: In-flight ${this.inFlight} exceeds 95% threshold ${threshold}`;
        }
        break;
      }

      case "HIGH": {
        // Shed only when hard limit is breached
        if (this.inFlight < this.currentLimit) {
          admitted = true;
        } else {
          reason = `SHED_HIGH: In-flight ${this.inFlight} reached limit ${this.currentLimit}`;
        }
        break;
      }

      case "CRITICAL": {
        // Critical requests utilize emergency reserve
        const criticalThreshold = this.currentLimit + this.emergencyHeadroom;
        if (this.inFlight < criticalThreshold) {
          admitted = true;
        } else {
          reason = `SHED_CRITICAL: Emergency headroom exhausted (${this.inFlight} >= ${criticalThreshold})`;
        }
        break;
      }
    }

    if (admitted) {
      this.inFlight++;
      this.totalAdmitted++;
      return this.buildDecision(true, priority);
    }

    this.totalShed++;
    this.shedByTier[priority]++;
    return this.buildDecision(false, priority, reason);
  }

  /**
   * Releases an execution slot and feeds observed latency back into Vegas gradient.
   */
  public release(observedRttMs?: number): void {
    if (this.inFlight > 0) {
      this.inFlight--;
    }
    if (observedRttMs !== undefined && observedRttMs > 0) {
      this.recordLatency(observedRttMs);
    }
  }

  /**
   * Records latency observation and updates Vegas gradient concurrency limits.
   */
  public recordLatency(rttMs: number): void {
    const rtt = Math.max(1, rttMs);

    // Update baseline minimum RTT
    if (this.baselineRttMs === 0 || rtt < this.baselineRttMs) {
      this.baselineRttMs = rtt;
    }

    if (this.currentRttMs === 0) {
      this.currentRttMs = rtt;
    } else {
      // Exponential moving average for current RTT
      this.currentRttMs = Number(
        (this.smoothingAlpha * rtt + (1.0 - this.smoothingAlpha) * this.currentRttMs).toFixed(2),
      );
    }

    // Calculate Vegas Gradient: baseline / current
    const gradient = this.currentRttMs > 0 ? Math.max(0.1, Math.min(1.0, this.baselineRttMs / this.currentRttMs)) : 1.0;

    // Vegas limit adjustment: Limit_{t+1} = Limit_t * Gradient + Headroom
    const newLimit = Math.round(this.currentLimit * gradient + this.queueHeadroom);
    this.currentLimit = Math.max(this.minLimit, Math.min(this.maxLimit, newLimit));
  }

  /**
   * Retrieves comprehensive metrics, gradient state, and cryptographic receipt.
   */
  public getStatus(): ConcurrencyGovernorStatus {
    const gradient =
      this.currentRttMs > 0
        ? Number(Math.max(0.1, Math.min(1.0, this.baselineRttMs / this.currentRttMs)).toFixed(4))
        : 1.0;

    const payload = {
      currentLimit: this.currentLimit,
      inFlight: this.inFlight,
      baselineRttMs: this.baselineRttMs,
      currentRttMs: this.currentRttMs,
      gradient,
      totalAdmitted: this.totalAdmitted,
      totalShed: this.totalShed,
      shedByTier: this.shedByTier,
    };

    const sha256Receipt = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return {
      currentLimit: this.currentLimit,
      inFlight: this.inFlight,
      baselineRttMs: this.baselineRttMs,
      currentRttMs: this.currentRttMs,
      gradient,
      totalAdmitted: this.totalAdmitted,
      totalShed: this.totalShed,
      shedByTier: { ...this.shedByTier },
      sha256Receipt,
    };
  }

  /**
   * Resets all internal state and counters to initial configuration.
   */
  public reset(initialLimit?: number): void {
    this.currentLimit = initialLimit ?? 50;
    this.inFlight = 0;
    this.baselineRttMs = 0;
    this.currentRttMs = 0;
    this.totalAdmitted = 0;
    this.totalShed = 0;
    this.shedByTier.CRITICAL = 0;
    this.shedByTier.HIGH = 0;
    this.shedByTier.NORMAL = 0;
    this.shedByTier.BEST_EFFORT = 0;
  }

  private buildDecision(admitted: boolean, priority: PriorityTier, reason?: string): AdmissionDecision {
    const payload = {
      admitted,
      currentLimit: this.currentLimit,
      inFlight: this.inFlight,
      priority,
      reason: reason || "NOMINAL_ADMISSION",
      timestamp: Date.now(),
    };

    const sha256Receipt = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return {
      admitted,
      currentLimit: this.currentLimit,
      inFlight: this.inFlight,
      priority,
      reason,
      sha256Receipt,
    };
  }
}
