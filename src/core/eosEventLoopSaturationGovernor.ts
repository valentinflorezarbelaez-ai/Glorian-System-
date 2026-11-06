/**
 * EOS SYSTEM — META V8 EVENT LOOP LATENCY HISTOGRAM & ADAPTIVE BACKPRESSURE GOVERNOR (Layer 0)
 * Governed by SPEC-087, CHANGE-064, ADR-088, FR-310..FR-313, BDD-249, BDD-250 (v72.0.0)
 *
 * Implements high-resolution V8 Event Loop delay tracking & backpressure shedding:
 * 1. Uses node:perf_hooks `monitorEventLoopDelay({ resolution: 10 })`.
 * 2. Computes atomic percentiles: p50, p90, p99, and max in milliseconds.
 * 3. Triggers fail-closed load shedding when p99 delay exceeds critical threshold (e.g. > 10ms).
 * 4. Implements hysteresis cooling: recovers to NORMAL only after consecutive clean sampling cycles.
 *
 * Zero external runtime npm dependencies (Law V).
 */

import { monitorEventLoopDelay } from "node:perf_hooks";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze
} from "./eosKernelPrimitives.ts";

export type EventLoopHistogram = ReturnType<typeof monitorEventLoopDelay>;

export type GovernorState = "NORMAL" | "SHEDDING_ACTIVE";

export type WorkloadPriority = "LOW" | "NORMAL" | "CRITICAL";

export interface EventLoopLatencyReport {
  readonly state: GovernorState;
  readonly p50Ms: number;
  readonly p90Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly meanMs: number;
  readonly criticalThresholdMs: number;
  readonly totalSamples: number;
  readonly sheddingActive: boolean;
  readonly timestampIso: string;
}

export class EosEventLoopSaturationGovernor {
  private readonly criticalThresholdMs: number;
  private readonly coolingCyclesRequired: number;
  private histogram: EventLoopHistogram | null = null;
  private state: GovernorState = "NORMAL";
  private consecutiveCoolCycles: number = 0;
  private simulatedLagMs: number = 0;

  constructor(criticalThresholdMs: number = 10.0, coolingCyclesRequired: number = 3) {
    assertPrecondition(criticalThresholdMs > 0, "Threshold must be greater than 0 ms");
    assertPrecondition(coolingCyclesRequired >= 1, "Cooling cycles must be at least 1");
    this.criticalThresholdMs = criticalThresholdMs;
    this.coolingCyclesRequired = coolingCyclesRequired;
  }

  public start(): void {
    if (!this.histogram) {
      try {
        this.histogram = monitorEventLoopDelay({ resolution: 10 });
        this.histogram.enable();
      } catch {
        // Fallback for mock environments
        this.histogram = null;
      }
    }
  }

  public stop(): void {
    if (this.histogram) {
      try {
        this.histogram.disable();
      } catch {
        // Ignore
      }
      this.histogram = null;
    }
  }

  /**
   * Injects a deterministic simulated lag for testing or synthetic stress drills.
   */
  public injectSimulatedLag(lagMs: number): void {
    this.simulatedLagMs = Math.max(0, lagMs);
  }

  /**
   * Samples the current V8 event loop histogram and updates state machine.
   */
  public sample(): EventLoopLatencyReport {
    let p50Ms = 0;
    let p90Ms = 0;
    let p99Ms = 0;
    let maxMs = 0;
    let meanMs = 0;
    let totalSamples = 0;

    if (this.histogram) {
      // Histogram metrics are in nanoseconds -> convert to milliseconds
      p50Ms = Number(this.histogram.percentile(50)) / 1_000_000;
      p90Ms = Number(this.histogram.percentile(90)) / 1_000_000;
      p99Ms = Number(this.histogram.percentile(99)) / 1_000_000;
      maxMs = Number(this.histogram.max) / 1_000_000;
      meanMs = Number(this.histogram.mean) / 1_000_000;
      totalSamples = Number(this.histogram.exceeds || 0);
    }

    if (this.simulatedLagMs > 0) {
      p50Ms = Math.max(p50Ms, this.simulatedLagMs * 0.5);
      p90Ms = Math.max(p90Ms, this.simulatedLagMs * 0.9);
      p99Ms = Math.max(p99Ms, this.simulatedLagMs);
      maxMs = Math.max(maxMs, this.simulatedLagMs * 1.2);
      meanMs = Math.max(meanMs, this.simulatedLagMs * 0.7);
    }

    // Evaluate state machine transitions
    if (p99Ms >= this.criticalThresholdMs) {
      this.state = "SHEDDING_ACTIVE";
      this.consecutiveCoolCycles = 0;
    } else if (p99Ms < this.criticalThresholdMs / 2) {
      this.consecutiveCoolCycles++;
      if (this.consecutiveCoolCycles >= this.coolingCyclesRequired) {
        this.state = "NORMAL";
      }
    } else {
      // In hysteresis zone between half and full threshold: retain current state
      this.consecutiveCoolCycles = 0;
    }

    return deepFreeze({
      state: this.state,
      p50Ms: Math.round(p50Ms * 100) / 100,
      p90Ms: Math.round(p90Ms * 100) / 100,
      p99Ms: Math.round(p99Ms * 100) / 100,
      maxMs: Math.round(maxMs * 100) / 100,
      meanMs: Math.round(meanMs * 100) / 100,
      criticalThresholdMs: this.criticalThresholdMs,
      totalSamples,
      sheddingActive: this.state === "SHEDDING_ACTIVE",
      timestampIso: new Date().toISOString()
    });
  }

  /**
   * Determines if incoming work should be shed based on current event loop health and task priority.
   */
  public shouldShedLoad(priority: WorkloadPriority = "NORMAL"): boolean {
    if (this.state === "NORMAL") return false;

    // Critical workloads are never shed
    if (priority === "CRITICAL") return false;

    // In SHEDDING_ACTIVE, shed LOW and NORMAL priority work
    return true;
  }

  public getState(): GovernorState {
    return this.state;
  }

  public reset(): void {
    if (this.histogram) {
      try {
        this.histogram.reset();
      } catch {
        // Ignore
      }
    }
    this.simulatedLagMs = 0;
    this.state = "NORMAL";
    this.consecutiveCoolCycles = 0;
  }
}
