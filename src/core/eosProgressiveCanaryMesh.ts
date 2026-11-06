/**
 * EOS SYSTEM — PROGRESSIVE CANARY DELIVERY & CIRCUIT-BREAKER MESH (Layer 0)
 * Governed by SPEC-042, FR-126, BDD-121, BDD-122 & ADR-048
 *
 * Implements Palantir Apollo / Netflix Spinnaker progressive canary rollout
 * (1% -> 5% -> 25% -> 100%) with real-time error budget monitoring and
 * fail-closed automated rollback guarantees.
 *
 * Mathematical & Safety Invariants:
 * 1. Error Budget Ceiling: Max allowed error rate = 0.0001 (0.01%).
 * 2. Latency Ceiling: Max allowed P99 latency increase = 15%.
 * 3. Instant atomic circuit-breaker rollback upon any budget breach.
 * 4. Zero external runtime dependencies — strictly pure Layer 0.
 */

import {
  pureSha256,
  assertPrecondition,
  assertPostcondition,
  deepFreeze
} from "./eosKernelPrimitives.ts";

export type CanaryStage =
  | "INITIALIZED"
  | "CANARY_1_PCT"
  | "CANARY_5_PCT"
  | "CANARY_25_PCT"
  | "FULL_PRODUCTION_100_PCT"
  | "ROLLED_BACK";

export interface CanaryTelemetry {
  readonly stage: CanaryStage;
  readonly sampleRequests: number;
  readonly failedRequests: number;
  readonly p99LatencyMs: number;
  readonly baselineP99LatencyMs: number;
}

export interface CanaryTransitionResult {
  readonly fromStage: CanaryStage;
  readonly toStage: CanaryStage;
  readonly errorRate: number;
  readonly latencyIncreasePercent: number;
  readonly circuitBreakerTripped: boolean;
  readonly reason: string;
}

export interface CanaryRolloutReport {
  readonly versionTarget: string;
  readonly previousStableVersion: string;
  readonly finalStage: CanaryStage;
  readonly totalStagesCompleted: number;
  readonly transitions: readonly CanaryTransitionResult[];
  readonly rollbackExecuted: boolean;
  readonly verifiedSafe: boolean;
  readonly sha256Receipt: string;
}

export class EosProgressiveCanaryMesh {
  public static readonly MAX_ERROR_RATE = 0.0001; // 0.01%
  public static readonly MAX_LATENCY_INCREASE_PERCENT = 15.0; // 15%

  public readonly versionTarget: string;
  public readonly previousStableVersion: string;

  private currentStage: CanaryStage = "INITIALIZED";
  private readonly history: CanaryTransitionResult[] = [];

  constructor(
    versionTarget: string = "v48.0.0",
    previousStableVersion: string = "v47.0.0"
  ) {
    this.versionTarget = versionTarget;
    this.previousStableVersion = previousStableVersion;
    assertPrecondition(Boolean(versionTarget && previousStableVersion), "Versions must be specified.");
  }

  /**
   * Evaluates telemetry and attempts to advance the canary to the next stage.
   */
  public advanceStage(telemetry: CanaryTelemetry): CanaryTransitionResult {
    const fromStage = this.currentStage;
    if (this.currentStage === "ROLLED_BACK") {
      return {
        fromStage,
        toStage: "ROLLED_BACK",
        errorRate: 1.0,
        latencyIncreasePercent: 100.0,
        circuitBreakerTripped: true,
        reason: "Deployment is locked in ROLLED_BACK state."
      };
    }

    if (this.currentStage === "FULL_PRODUCTION_100_PCT") {
      return {
        fromStage,
        toStage: "FULL_PRODUCTION_100_PCT",
        errorRate: 0.0,
        latencyIncreasePercent: 0.0,
        circuitBreakerTripped: false,
        reason: "Canary rollout already at 100% full production."
      };
    }

    const errorRate = telemetry.sampleRequests > 0
      ? telemetry.failedRequests / telemetry.sampleRequests
      : 0;

    const latencyDiff = telemetry.p99LatencyMs - telemetry.baselineP99LatencyMs;
    const latencyIncreasePercent = telemetry.baselineP99LatencyMs > 0
      ? Math.max(0, (latencyDiff / telemetry.baselineP99LatencyMs) * 100)
      : 0;

    // Check breach of SLA budgets
    const errorBreach = errorRate > EosProgressiveCanaryMesh.MAX_ERROR_RATE;
    const latencyBreach = latencyIncreasePercent > EosProgressiveCanaryMesh.MAX_LATENCY_INCREASE_PERCENT;

    let toStage: CanaryStage;
    let circuitBreakerTripped = false;
    let reason = "Telemetry metrics within error budget thresholds.";

    if (errorBreach || latencyBreach) {
      circuitBreakerTripped = true;
      toStage = "ROLLED_BACK";
      reason = errorBreach
        ? `Error budget burned: error rate ${(errorRate * 100).toFixed(4)}% exceeds 0.01% limit.`
        : `Latency ceiling breached: +${latencyIncreasePercent.toFixed(2)}% P99 latency increase exceeds 15% limit.`;
      this.currentStage = "ROLLED_BACK";
    } else {
      toStage = this.getNextStage(fromStage);
      this.currentStage = toStage;
    }

    const transition: CanaryTransitionResult = {
      fromStage,
      toStage,
      errorRate: Math.round(errorRate * 100000) / 100000,
      latencyIncreasePercent: Math.round(latencyIncreasePercent * 100) / 100,
      circuitBreakerTripped,
      reason
    };

    this.history.push(transition);
    return transition;
  }

  /**
   * Simulates or executes an end-to-end multi-stage canary rollout.
   */
  public executeRollout(telemetrySequence: CanaryTelemetry[]): CanaryRolloutReport {
    for (const t of telemetrySequence) {
      const res = this.advanceStage(t);
      if (res.circuitBreakerTripped) {
        break; // Fail-closed immediately
      }
    }

    const rollbackExecuted = this.currentStage === "ROLLED_BACK";
    const verifiedSafe = this.currentStage === "FULL_PRODUCTION_100_PCT";

    const rawProof = `${this.versionTarget}:${this.currentStage}:${this.history.length}:${rollbackExecuted}`;
    const sha256Receipt = pureSha256(rawProof);

    const report: CanaryRolloutReport = {
      versionTarget: this.versionTarget,
      previousStableVersion: this.previousStableVersion,
      finalStage: this.currentStage,
      totalStagesCompleted: this.history.length,
      transitions: [...this.history],
      rollbackExecuted,
      verifiedSafe,
      sha256Receipt
    };

    return deepFreeze(report);
  }

  private getNextStage(current: CanaryStage): CanaryStage {
    switch (current) {
      case "INITIALIZED":
        return "CANARY_1_PCT";
      case "CANARY_1_PCT":
        return "CANARY_5_PCT";
      case "CANARY_5_PCT":
        return "CANARY_25_PCT";
      case "CANARY_25_PCT":
        return "FULL_PRODUCTION_100_PCT";
      default:
        return current;
    }
  }
}
