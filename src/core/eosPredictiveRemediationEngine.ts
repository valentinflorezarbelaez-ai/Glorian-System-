/**
 * EOS Predictive Failure Correlator & Closed-Loop Auto-Remediation Engine (SPEC-114)
 *
 * Implements Google Autonomous SRE & Meta Sherlock/Aegis production doctrines:
 * 1. Multi-signal telemetry correlation (SLO burn rates, Vegas gradient, queue wait, trace error density).
 * 2. Deterministic incident archetype pattern matching.
 * 3. Closed-loop automated mitigation playbooks (throttle, suppress hedging, load shed, rollback).
 * 4. Anti-flapping hysteresis cooldown and graceful recovery to nominal state.
 * 5. Cryptographic SHA-256 verifiable remediation audit receipts.
 *
 * Layer 0 Purity: Zero runtime npm dependencies.
 */

import { createHash } from "node:crypto";

export interface TelemetryHealthVector {
  readonly burnRate5m: number;
  readonly burnRate1h: number;
  readonly concurrencyGradient: number;
  readonly concurrencyInFlightRatio: number;
  readonly traceErrorRate: number;
  readonly traceP99LatencyMs: number;
  readonly hedgeRequestRatio: number;
  readonly queueDelayMs: number;
}

export type FailureArchetype =
  | "ARCHETYPE_NOMINAL"
  | "ARCHETYPE_CASCADE_TIMEOUT"
  | "ARCHETYPE_RETRY_STORM"
  | "ARCHETYPE_CONCURRENCY_COLLAPSE"
  | "ARCHETYPE_RELEASE_REGRESSION";

export type RemediationActionType =
  | "ACTION_NONE"
  | "ACTION_CONCURRENCY_THROTTLE"
  | "ACTION_SUPPRESS_SPECULATIVE_HEDGING"
  | "ACTION_SHED_BEST_EFFORT"
  | "ACTION_CANARY_ROLLBACK"
  | "ACTION_REVERT_TO_NOMINAL";

export interface RemediationExecutionResult {
  readonly archetype: FailureArchetype;
  readonly action: RemediationActionType;
  readonly executed: boolean;
  readonly suppressedReason?: string;
  readonly healthScore: number;
  readonly timestampMs: number;
  readonly sha256Receipt: string;
}

export interface RemediationEngineConfig {
  readonly cooldownMs?: number;               // default: 30,000ms
  readonly minHealthScoreThreshold?: number;  // default: 70
  readonly maxRecoveryWindowMs?: number;      // default: 60,000ms
}

export interface RemediationEngineStatus {
  readonly activeArchetype: FailureArchetype;
  readonly activeAction: RemediationActionType;
  readonly currentHealthScore: number;
  readonly totalEvaluations: number;
  readonly totalRemediationsExecuted: number;
  readonly totalSuppressedCooldown: number;
  readonly lastMitigationTimestampMs: number;
  readonly sha256Receipt: string;
}

export class EosPredictiveRemediationEngine {
  private readonly cooldownMs: number;
  private readonly minHealthScoreThreshold: number;

  private activeArchetype: FailureArchetype = "ARCHETYPE_NOMINAL";
  private activeAction: RemediationActionType = "ACTION_NONE";
  private currentHealthScore = 100;

  private totalEvaluations = 0;
  private totalRemediationsExecuted = 0;
  private totalSuppressedCooldown = 0;
  private lastMitigationTimestampMs = 0;

  constructor(config: RemediationEngineConfig = {}) {
    this.cooldownMs = config.cooldownMs ?? 30_000;
    this.minHealthScoreThreshold = config.minHealthScoreThreshold ?? 70;
  }

  /**
   * Ingests a multi-signal health vector, classifies failure archetypes,
   * and executes or suppresses closed-loop auto-remediation playbooks.
   */
  public evaluateAndRemediate(vector: TelemetryHealthVector): RemediationExecutionResult {
    const now = Date.now();
    this.totalEvaluations++;

    const healthScore = this.calculateHealthScore(vector);
    this.currentHealthScore = healthScore;

    const archetype = this.classifyArchetype(vector, healthScore);
    this.activeArchetype = archetype;

    let targetAction: RemediationActionType = "ACTION_NONE";

    switch (archetype) {
      case "ARCHETYPE_CASCADE_TIMEOUT":
        targetAction = "ACTION_CONCURRENCY_THROTTLE";
        break;
      case "ARCHETYPE_RETRY_STORM":
        targetAction = "ACTION_SUPPRESS_SPECULATIVE_HEDGING";
        break;
      case "ARCHETYPE_CONCURRENCY_COLLAPSE":
        targetAction = "ACTION_SHED_BEST_EFFORT";
        break;
      case "ARCHETYPE_RELEASE_REGRESSION":
        targetAction = "ACTION_CANARY_ROLLBACK";
        break;
      case "ARCHETYPE_NOMINAL":
        if (this.activeAction !== "ACTION_NONE") {
          targetAction = "ACTION_REVERT_TO_NOMINAL";
        } else {
          targetAction = "ACTION_NONE";
        }
        break;
    }

    // Evaluate cooldown anti-flapping guard
    let executed = false;
    let suppressedReason: string | undefined;

    if (targetAction === "ACTION_NONE") {
      executed = false;
    } else if (targetAction === "ACTION_REVERT_TO_NOMINAL") {
      // Reversion is allowed if cooldown has expired or health has completely recovered
      if (now - this.lastMitigationTimestampMs >= this.cooldownMs || healthScore >= 90) {
        executed = true;
        this.activeAction = "ACTION_NONE";
        this.lastMitigationTimestampMs = now;
      } else {
        executed = false;
        suppressedReason = "SUPPRESSED_COOLDOWN_ACTIVE";
        this.totalSuppressedCooldown++;
      }
    } else {
      // Mitigating action
      const inCooldown = now - this.lastMitigationTimestampMs < this.cooldownMs;
      if (inCooldown && this.activeAction === targetAction) {
        executed = false;
        suppressedReason = "SUPPRESSED_COOLDOWN_ACTIVE";
        this.totalSuppressedCooldown++;
      } else {
        executed = true;
        this.activeAction = targetAction;
        this.lastMitigationTimestampMs = now;
        this.totalRemediationsExecuted++;
      }
    }

    const receipt = createHash("sha256")
      .update(
        `REMEDIATE:${archetype}:${targetAction}:${executed}:${healthScore}:${now}:${this.totalEvaluations}`
      )
      .digest("hex");

    return {
      archetype,
      action: targetAction,
      executed,
      suppressedReason,
      healthScore,
      timestampMs: now,
      sha256Receipt: receipt,
    };
  }

  /**
   * Forces an explicit mitigation action (for manual overrides or emergency drills).
   */
  public forceRemediate(
    action: RemediationActionType,
    archetype: FailureArchetype = "ARCHETYPE_CASCADE_TIMEOUT"
  ): RemediationExecutionResult {
    const now = Date.now();
    this.totalEvaluations++;
    this.totalRemediationsExecuted++;
    this.activeAction = action;
    this.activeArchetype = archetype;
    this.lastMitigationTimestampMs = now;

    const receipt = createHash("sha256")
      .update(`FORCE_REMEDIATE:${archetype}:${action}:${now}`)
      .digest("hex");

    return {
      archetype,
      action,
      executed: true,
      healthScore: this.currentHealthScore,
      timestampMs: now,
      sha256Receipt: receipt,
    };
  }

  /**
   * Returns complete telemetry and status metrics.
   */
  public getStatus(): RemediationEngineStatus {
    const receipt = createHash("sha256")
      .update(
        `STATUS:${this.activeArchetype}:${this.activeAction}:${this.currentHealthScore}:${this.totalEvaluations}:${this.totalRemediationsExecuted}:${this.totalSuppressedCooldown}`
      )
      .digest("hex");

    return {
      activeArchetype: this.activeArchetype,
      activeAction: this.activeAction,
      currentHealthScore: this.currentHealthScore,
      totalEvaluations: this.totalEvaluations,
      totalRemediationsExecuted: this.totalRemediationsExecuted,
      totalSuppressedCooldown: this.totalSuppressedCooldown,
      lastMitigationTimestampMs: this.lastMitigationTimestampMs,
      sha256Receipt: receipt,
    };
  }

  /**
   * Resets engine to clean nominal state.
   */
  public reset(): void {
    this.activeArchetype = "ARCHETYPE_NOMINAL";
    this.activeAction = "ACTION_NONE";
    this.currentHealthScore = 100;
    this.totalEvaluations = 0;
    this.totalRemediationsExecuted = 0;
    this.totalSuppressedCooldown = 0;
    this.lastMitigationTimestampMs = 0;
  }

  /**
   * Computes composite health score [0..100] from multi-dimensional telemetry vector.
   */
  private calculateHealthScore(v: TelemetryHealthVector): number {
    let score = 100;

    // Penalty for SLO Burn Rate
    if (v.burnRate5m > 14.4) {
      score -= 35;
    } else if (v.burnRate5m > 5.0) {
      score -= 20;
    } else if (v.burnRate5m > 1.0) {
      score -= 10;
    }

    // Penalty for Concurrency Congestion (Vegas gradient depression)
    if (v.concurrencyGradient < 0.4) {
      score -= 30;
    } else if (v.concurrencyGradient < 0.7) {
      score -= 15;
    }

    // Penalty for Trace Error Rate
    if (v.traceErrorRate > 0.10) {
      score -= 25;
    } else if (v.traceErrorRate > 0.02) {
      score -= 10;
    }

    // Penalty for Tail Latency P99
    if (v.traceP99LatencyMs > 800) {
      score -= 20;
    } else if (v.traceP99LatencyMs > 400) {
      score -= 10;
    }

    // Penalty for CoDel Queue Delays
    if (v.queueDelayMs > 15) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Deterministically matches incident signatures against canonical Big Tech archetypes.
   */
  private classifyArchetype(v: TelemetryHealthVector, healthScore: number): FailureArchetype {
    // 1. Nominal check
    if (healthScore >= 85 && v.burnRate5m <= 1.0) {
      return "ARCHETYPE_NOMINAL";
    }

    // 2. Cascade Timeout Archetype (downstream dependency collapse)
    if (v.traceP99LatencyMs > 800 && v.concurrencyGradient < 0.40 && v.burnRate5m > 3.0) {
      return "ARCHETYPE_CASCADE_TIMEOUT";
    }

    // 3. Retry Storm Archetype (thundering herd speculative amplification)
    if (v.hedgeRequestRatio > 0.05 && v.traceErrorRate > 0.10) {
      return "ARCHETYPE_RETRY_STORM";
    }

    // 4. Concurrency Collapse Archetype (bufferbloat / thread pool exhaustion)
    if (v.concurrencyInFlightRatio >= 0.95 && v.queueDelayMs > 15) {
      return "ARCHETYPE_CONCURRENCY_COLLAPSE";
    }

    // 5. Release Regression Archetype (sudden error jump with healthy network gradient)
    if (v.burnRate5m > 14.4 && v.concurrencyGradient >= 0.75) {
      return "ARCHETYPE_RELEASE_REGRESSION";
    }

    // Degraded fallback
    if (healthScore < this.minHealthScoreThreshold) {
      return "ARCHETYPE_CASCADE_TIMEOUT";
    }

    return "ARCHETYPE_NOMINAL";
  }
}
