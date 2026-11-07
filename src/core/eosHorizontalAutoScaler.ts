/**
 * EOS SYSTEM — HORIZONTAL AUTO-SCALER SIMULATOR (Layer 0)
 * Governed by SPEC-162 (Kubernetes HPA / AWS Auto Scaling pattern)
 *
 * Implements:
 * - Metrics-driven desired-replica calculation
 * - Scale-up / down stabilization windows (cooldown)
 * - Rate-of-change limiting (max scale delta per tick)
 * - Deterministic decision trace + fingerprint
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface AutoScalerConfig {
  readonly minReplicas: number;
  readonly maxReplicas: number;
  readonly targetUtilization: number; // Target CPU/metric % per replica
  readonly scaleUpCooldownTicks: number;
  readonly scaleDownCooldownTicks: number;
  readonly maxDeltaPerTick: number; // Rate limit on replica changes
}

export interface ScaleDecision {
  readonly tick: number;
  readonly observedMetric: number;
  readonly currentReplicas: number;
  readonly desiredReplicas: number;
  readonly action: "SCALE_UP" | "SCALE_DOWN" | "HOLD" | "COOLDOWN";
  readonly reason: string;
}

export class EosHorizontalAutoScaler {
  private readonly config: AutoScalerConfig;
  private currentReplicas: number;
  private lastScaleUpTick = -Infinity;
  private lastScaleDownTick = -Infinity;
  private tickCounter = 0;
  private readonly trace: ScaleDecision[] = [];

  constructor(config: AutoScalerConfig, initialReplicas?: number) {
    assertPrecondition(config.minReplicas >= 1, "minReplicas must be >= 1");
    assertPrecondition(config.maxReplicas >= config.minReplicas, "maxReplicas must be >= minReplicas");
    assertPrecondition(config.targetUtilization > 0, "targetUtilization must be positive");
    this.config = deepFreeze(config);
    this.currentReplicas = initialReplicas ?? config.minReplicas;
  }

  /**
   * Feeds one metric observation and returns the scaling decision.
   * @param aggregateLoad total demand across cluster (e.g. total CPU seconds)
   */
  observe(aggregateLoad: number): ScaleDecision {
    this.tickCounter += 1;
    const tick = this.tickCounter;
    const raw = Math.ceil(aggregateLoad / this.config.targetUtilization);
    let desired = Math.max(this.config.minReplicas, Math.min(this.config.maxReplicas, raw));

    // Rate limit: cap delta to maxDeltaPerTick
    const delta = desired - this.currentReplicas;
    if (Math.abs(delta) > this.config.maxDeltaPerTick) {
      desired = this.currentReplicas + Math.sign(delta) * this.config.maxDeltaPerTick;
    }

    let action: ScaleDecision["action"];
    let reason: string;

    if (desired > this.currentReplicas) {
      if (tick - this.lastScaleUpTick < this.config.scaleUpCooldownTicks) {
        action = "COOLDOWN";
        reason = `scale-up suppressed by ${this.config.scaleUpCooldownTicks}-tick cooldown`;
        desired = this.currentReplicas;
      } else {
        action = "SCALE_UP";
        reason = `load ${aggregateLoad} > capacity at ${this.currentReplicas} replicas`;
        this.lastScaleUpTick = tick;
      }
    } else if (desired < this.currentReplicas) {
      if (tick - this.lastScaleDownTick < this.config.scaleDownCooldownTicks) {
        action = "COOLDOWN";
        reason = `scale-down suppressed by ${this.config.scaleDownCooldownTicks}-tick cooldown`;
        desired = this.currentReplicas;
      } else {
        action = "SCALE_DOWN";
        reason = `load ${aggregateLoad} underutilizes ${this.currentReplicas} replicas`;
        this.lastScaleDownTick = tick;
      }
    } else {
      action = "HOLD";
      reason = "steady state";
    }

    this.currentReplicas = desired;
    const decision: ScaleDecision = deepFreeze({
      tick,
      observedMetric: aggregateLoad,
      currentReplicas: desired,
      desiredReplicas: desired,
      action,
      reason,
    });
    this.trace.push(decision);
    return decision;
  }

  get replicas(): number {
    return this.currentReplicas;
  }

  get history(): readonly ScaleDecision[] {
    return this.trace;
  }

  traceFingerprint(): string {
    return pureSha256(this.trace.map((d) => `${d.tick}:${d.action}:${d.currentReplicas}`).join("|"));
  }
}
