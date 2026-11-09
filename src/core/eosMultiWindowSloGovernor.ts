/**
 * EOS SYSTEM — LAYER-0 MULTI-WINDOW MULTI-BURN-RATE SLO & ERROR BUDGET GOVERNOR (SPEC-110)
 *
 * Implements Google Site Reliability Engineering (SRE) standard multi-window
 * multi-burn-rate alerting, sliding-window error budget accounting, and automated
 * sovereign fleet deployment freeze gates.
 *
 * Governed by SPEC-110, PLAN-110, ADR-110.
 * 100% Layer 0 Purity — zero external runtime npm dependencies.
 */

import crypto from "node:crypto";

export interface SloTargetConfig {
  readonly serviceId: string;
  readonly availabilitySlo?: number; // e.g. 0.999 (99.9%)
  readonly latencyThresholdMs?: number; // e.g. 400ms
  readonly latencySlo?: number; // e.g. 0.99 (99%)
  readonly periodTotalEventsBudget?: number; // e.g. 100,000 (30-day request budget envelope)
}

export type SloHealthState = "NOMINAL_HEALTHY" | "ELEVATED_BURN" | "CRITICAL_BURN" | "BUDGET_EXHAUSTED";

export interface BurnRateSnapshot {
  readonly windowLabel: string;
  readonly windowMs: number;
  readonly totalEvents: number;
  readonly totalErrors: number;
  readonly errorRate: number;
  readonly burnRate: number;
}

export interface ServiceSloStatus {
  readonly serviceId: string;
  readonly availabilitySlo: number;
  readonly errorBudgetFraction: number; // 1.0 - availabilitySlo
  readonly errorBudgetRemainingPct: number; // Bounded remaining percentage
  readonly isDeploymentFrozen: boolean;
  readonly healthState: SloHealthState;
  readonly windows: {
    readonly window5m: BurnRateSnapshot;
    readonly window30m: BurnRateSnapshot;
    readonly window1h: BurnRateSnapshot;
    readonly window6h: BurnRateSnapshot;
  };
  readonly activeAlerts: string[];
  readonly sha256Receipt: string;
}

export interface SloTelemetryEvent {
  readonly timestamp?: number;
  readonly isError?: boolean;
  readonly statusCode?: number;
  readonly latencyMs?: number;
}

interface RawEventRecord {
  readonly timestamp: number;
  readonly isError: boolean;
}

const WINDOW_5M_MS = 5 * 60 * 1000;
const WINDOW_30M_MS = 30 * 60 * 1000;
const WINDOW_1H_MS = 60 * 60 * 1000;
const WINDOW_6H_MS = 6 * 60 * 60 * 1000;
const COMPLIANCE_30D_MS = 30 * 24 * 60 * 60 * 1000;

export class EosMultiWindowSloGovernor {
  private readonly defaultAvailabilitySlo: number;
  private readonly targets = new Map<string, SloTargetConfig>();
  private readonly serviceBuffers = new Map<string, RawEventRecord[]>();

  constructor(defaultSlo = 0.999) {
    this.defaultAvailabilitySlo = Math.min(0.9999, Math.max(0.5, defaultSlo));
  }

  /**
   * Registers a custom SLO target configuration for a service.
   */
  public registerService(config: SloTargetConfig): void {
    this.targets.set(config.serviceId, config);
    if (!this.serviceBuffers.has(config.serviceId)) {
      this.serviceBuffers.set(config.serviceId, []);
    }
  }

  /**
   * Ingests a single telemetry event into the sliding window.
   */
  public ingestEvent(serviceId: string, event: SloTelemetryEvent): void {
    const buffer = this.getOrCreateBuffer(serviceId);
    const target = this.targets.get(serviceId);
    const latencyThreshold = target?.latencyThresholdMs ?? 400;

    let isError = Boolean(event.isError);
    if (!isError && event.statusCode !== undefined && event.statusCode >= 500) {
      isError = true;
    }
    if (!isError && event.latencyMs !== undefined && event.latencyMs > latencyThreshold) {
      isError = true;
    }

    const timestamp = event.timestamp ?? Date.now();
    const record: RawEventRecord = { timestamp, isError };

    // Maintain monotonic ascending order even with out-of-order distributed telemetry
    if (buffer.length === 0 || timestamp >= buffer[buffer.length - 1].timestamp) {
      buffer.push(record);
    } else {
      let low = 0;
      let high = buffer.length - 1;
      while (low <= high) {
        const mid = (low + high) >>> 1;
        if (buffer[mid].timestamp <= timestamp) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      buffer.splice(low, 0, record);
    }

    // Evict events older than 30 days to bound memory
    const cutoff = timestamp - COMPLIANCE_30D_MS;
    if (buffer.length > 5000 && buffer[0].timestamp < cutoff) {
      let purgeIdx = 0;
      while (purgeIdx < buffer.length && buffer[purgeIdx].timestamp < cutoff) {
        purgeIdx++;
      }
      buffer.splice(0, purgeIdx);
    }
  }

  /**
   * Ingests a batch of telemetry events for high-throughput batching.
   */
  public ingestBatch(serviceId: string, events: readonly SloTelemetryEvent[]): void {
    for (const ev of events) {
      this.ingestEvent(serviceId, ev);
    }
  }

  /**
   * Calculates a burn rate snapshot for a given duration window.
   */
  private computeWindowSnapshot(
    buffer: readonly RawEventRecord[],
    windowMs: number,
    label: string,
    errorBudgetFraction: number,
    now: number,
  ): BurnRateSnapshot {
    const cutoff = now - windowMs;
    let eventsCount = 0;
    let errorsCount = 0;

    for (let i = buffer.length - 1; i >= 0; i--) {
      const item = buffer[i];
      if (item.timestamp < cutoff) break;
      eventsCount++;
      if (item.isError) {
        errorsCount++;
      }
    }

    const errorRate = eventsCount > 0 ? errorsCount / eventsCount : 0;
    const burnRate = errorBudgetFraction > 0 ? Number((errorRate / errorBudgetFraction).toFixed(2)) : 0;

    return {
      windowLabel: label,
      windowMs,
      totalEvents: eventsCount,
      totalErrors: errorsCount,
      errorRate: Number(errorRate.toFixed(6)),
      burnRate,
    };
  }

  /**
   * Evaluates the Google SRE multi-window multi-burn-rate status for a service.
   */
  public evaluateService(serviceId: string, evaluationTimestamp?: number): ServiceSloStatus {
    const target = this.targets.get(serviceId);
    const availabilitySlo = target?.availabilitySlo ?? this.defaultAvailabilitySlo;
    const errorBudgetFraction = Number((1.0 - availabilitySlo).toFixed(6));
    const now = evaluationTimestamp ?? Date.now();
    const buffer = this.getOrCreateBuffer(serviceId);

    // Compute 4 canonical Google SRE windows
    const window5m = this.computeWindowSnapshot(buffer, WINDOW_5M_MS, "5m", errorBudgetFraction, now);
    const window30m = this.computeWindowSnapshot(buffer, WINDOW_30M_MS, "30m", errorBudgetFraction, now);
    const window1h = this.computeWindowSnapshot(buffer, WINDOW_1H_MS, "1h", errorBudgetFraction, now);
    const window6h = this.computeWindowSnapshot(buffer, WINDOW_6H_MS, "6h", errorBudgetFraction, now);

    // 30-day compliance budget calculation
    const window30d = this.computeWindowSnapshot(buffer, COMPLIANCE_30D_MS, "30d", errorBudgetFraction, now);
    const periodBudgetEnvelope = target?.periodTotalEventsBudget ?? Math.max(window30d.totalEvents, 100_000);
    const allowedPeriodErrors = periodBudgetEnvelope * errorBudgetFraction;
    const budgetRemainingPct =
      allowedPeriodErrors > 0 && window30d.totalEvents > 0
        ? Number(Math.max(-100, Math.min(100, (1.0 - window30d.totalErrors / allowedPeriodErrors) * 100)).toFixed(2))
        : 100;

    const activeAlerts: string[] = [];
    let isDeploymentFrozen = false;
    let healthState: SloHealthState = "NOMINAL_HEALTHY";

    // Google SRE Rule 1: Tier 1 Critical (14.4x burn rate in 1h AND 5m) -> Consumes 2% in 1h
    if (window1h.burnRate >= 14.4 && window5m.burnRate >= 14.4) {
      activeAlerts.push(
        "ALERT_TIER_1_CRITICAL: 1h burn rate >= 14.4x correlated with 5m window. Emergency rollback recommended.",
      );
      isDeploymentFrozen = true;
      healthState = "CRITICAL_BURN";
    }

    // Google SRE Rule 2: Tier 2 Warning (6.0x burn rate in 6h AND 30m) -> Consumes 5% in 6h
    if (window6h.burnRate >= 6.0 && window30m.burnRate >= 6.0) {
      activeAlerts.push(
        "ALERT_TIER_2_WARNING: 6h burn rate >= 6.0x correlated with 30m window. Canary promotions held.",
      );
      if (healthState !== "CRITICAL_BURN") {
        healthState = "ELEVATED_BURN";
      }
    }

    // Google SRE Rule 3: Error budget exhausted -> Hard deployment freeze
    if (budgetRemainingPct <= 0 && window30d.totalErrors > 0) {
      activeAlerts.push("ALERT_BUDGET_EXHAUSTED: 30-day error budget depleted. Sovereign deployment freeze enforced.");
      isDeploymentFrozen = true;
      healthState = "BUDGET_EXHAUSTED";
    }

    const payloadToSign = {
      serviceId,
      availabilitySlo,
      budgetRemainingPct,
      isDeploymentFrozen,
      healthState,
      alertsCount: activeAlerts.length,
      timestamp: now,
    };

    const sha256Receipt = crypto.createHash("sha256").update(JSON.stringify(payloadToSign)).digest("hex");

    return Object.freeze({
      serviceId,
      availabilitySlo,
      errorBudgetFraction,
      errorBudgetRemainingPct: budgetRemainingPct,
      isDeploymentFrozen,
      healthState,
      windows: {
        window5m,
        window30m,
        window1h,
        window6h,
      },
      activeAlerts,
      sha256Receipt,
    });
  }

  /**
   * Check if deployment is permitted for a service (fail-closed guard).
   */
  public isDeploymentAllowed(serviceId: string, evaluationTimestamp?: number): { allowed: boolean; reason?: string } {
    const status = this.evaluateService(serviceId, evaluationTimestamp);
    if (status.isDeploymentFrozen) {
      return {
        allowed: false,
        reason: `DEPLOYMENT_FROZEN: Service ${serviceId} has active burn alerts or exhausted error budget (${status.errorBudgetRemainingPct}% remaining)`,
      };
    }
    return { allowed: true };
  }

  /**
   * Retrieves status for all registered services across the fleet.
   */
  public getAllServiceStatuses(): ServiceSloStatus[] {
    const list: ServiceSloStatus[] = [];
    for (const [serviceId] of this.serviceBuffers) {
      list.push(this.evaluateService(serviceId));
    }
    return list;
  }

  /**
   * Resets buffer for a service (e.g. after maintenance or testing).
   */
  public resetService(serviceId: string): void {
    this.serviceBuffers.set(serviceId, []);
  }

  private getOrCreateBuffer(serviceId: string): RawEventRecord[] {
    let buffer = this.serviceBuffers.get(serviceId);
    if (!buffer) {
      buffer = [];
      this.serviceBuffers.set(serviceId, buffer);
    }
    return buffer;
  }
}
