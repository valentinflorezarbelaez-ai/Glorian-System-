/**
 * EOS SYSTEM — VERCEL CANARY OBSERVABILITY & AUTOMATED CANARY ANALYSIS (Layer 0)
 * Governed by SPEC-107, FR-281 through FR-284, BDD-273 through BDD-275 & ADR-107
 *
 * Implements Netflix Kayenta-grade Automated Canary Analysis (ACA) and
 * real-time telemetry evaluation for progressive canary deployments on Vercel.
 *
 * Mathematical & Architectural Invariants:
 * 1. Canary Health Index (CHI) is strictly bounded within [0, 100].
 * 2. Any 5xx error rate > critical threshold deterministically triggers ROLLBACK_TRIGGERED.
 * 3. Zero external runtime dependencies — strictly pure Layer 0.
 */

import { pureSha256, assertPrecondition, assertPostcondition, deepFreeze } from "./eosKernelPrimitives.ts";

export type CanaryStage = "CANARY_1_PCT" | "CANARY_5_PCT" | "CANARY_25_PCT" | "FULL_PRODUCTION_100_PCT";

export type CanaryDecision = "PROCEED_TO_NEXT_STAGE" | "HOLD_AND_OBSERVE" | "ROLLBACK_TRIGGERED";

export interface CanaryTelemetryInput {
  readonly deploymentId: string;
  readonly environment: "production" | "preview";
  readonly stage: CanaryStage;
  readonly errorRate5xx: number; // 0.0 to 1.0 (e.g. 0.005 for 0.5%)
  readonly latencyP99Ms: number;
  readonly requestCount: number;
  readonly criticalErrorThreshold?: number; // default 0.01 (1.0%)
}

export interface CanaryEvaluationResult {
  readonly evaluatedTimestamp: number;
  readonly deploymentId: string;
  readonly stage: CanaryStage;
  readonly canaryHealthIndex: number; // 0 - 100
  readonly decision: CanaryDecision;
  readonly errorRateObserved: number;
  readonly latencyP99Ms: number;
  readonly requestCount: number;
  readonly errorBudgetRemainingPercent: number;
  readonly rationale: string;
  readonly sha256Receipt: string;
}

export class EosVercelCanaryObservability {
  public static readonly DEFAULT_ERROR_THRESHOLD = 0.01; // 1.0% error rate
  public static readonly LATENCY_CEILING_MS = 800; // P99 threshold

  /**
   * Evaluates telemetry metrics from a canary deployment and computes the
   * Canary Health Index (CHI) and next progressive action.
   */
  public static evaluateMetrics(input: CanaryTelemetryInput): CanaryEvaluationResult {
    assertPrecondition(Boolean(input.deploymentId), "deploymentId must not be empty");
    assertPrecondition(input.errorRate5xx >= 0 && input.errorRate5xx <= 1, "errorRate5xx must be bounded in [0, 1]");
    assertPrecondition(input.latencyP99Ms >= 0, "latencyP99Ms must be non-negative");
    assertPrecondition(input.requestCount >= 0, "requestCount must be non-negative");

    const threshold = input.criticalErrorThreshold ?? this.DEFAULT_ERROR_THRESHOLD;

    // 1. Error Rate Penalty (Scale: 0 - 60 points)
    // 0.5% error -> 10 pts penalty. 1.0% error -> 20 pts. 2.5% error -> 50 pts. Max 60 pts.
    const errorPenalty = Math.min(60, input.errorRate5xx * 2000);

    // 2. Latency P99 Penalty (Scale: 0 - 30 points)
    let latencyPenalty = 0;
    if (input.latencyP99Ms > this.LATENCY_CEILING_MS) {
      latencyPenalty = Math.min(30, (input.latencyP99Ms - this.LATENCY_CEILING_MS) / 40);
    }

    // 3. Sample Size Damping (Scale: 0 - 10 points for small sample batches)
    const samplePenalty = input.requestCount < 50 ? 5 : 0;

    // 4. Compute Canary Health Index (CHI)
    const rawChi = Math.round(100 - errorPenalty - latencyPenalty - samplePenalty);
    const chi = Math.max(0, Math.min(100, rawChi));

    assertPostcondition(chi >= 0 && chi <= 100, "Canary Health Index must be bounded in [0, 100]");

    // 5. Compute Error Budget Remaining
    const errorRatio = input.errorRate5xx / Math.max(0.0001, threshold);
    const budgetRemaining = Math.max(0, Math.min(100, Math.round((1 - errorRatio) * 100)));

    // 6. Deterministic Decision Matrix
    let decision: CanaryDecision;
    let rationale: string;

    if (input.errorRate5xx > threshold || chi < 70) {
      decision = "ROLLBACK_TRIGGERED";
      rationale = `Circuit breaker tripped: error rate ${(input.errorRate5xx * 100).toFixed(2)}% exceeded threshold ${(threshold * 100).toFixed(2)}% or CHI ${chi} < 70. Initiating automatic rollback.`;
    } else if (chi >= 85 && budgetRemaining >= 20) {
      decision = "PROCEED_TO_NEXT_STAGE";
      rationale = `Canary is healthy (CHI: ${chi}/100, Error Rate: ${(input.errorRate5xx * 100).toFixed(2)}%, Latency P99: ${input.latencyP99Ms}ms). Promotion to next progressive stage authorized.`;
    } else {
      decision = "HOLD_AND_OBSERVE";
      rationale = `Canary metrics are within safe boundaries but require additional sample accumulation (CHI: ${chi}/100).`;
    }

    const timestamp = Date.now();
    const receiptRaw = `${timestamp}:${input.deploymentId}:${input.stage}:${chi}:${decision}:${budgetRemaining}`;
    const sha256Receipt = pureSha256(receiptRaw);

    const result: CanaryEvaluationResult = {
      evaluatedTimestamp: timestamp,
      deploymentId: input.deploymentId,
      stage: input.stage,
      canaryHealthIndex: chi,
      decision,
      errorRateObserved: input.errorRate5xx,
      latencyP99Ms: input.latencyP99Ms,
      requestCount: input.requestCount,
      errorBudgetRemainingPercent: budgetRemaining,
      rationale,
      sha256Receipt,
    };

    return deepFreeze(result);
  }
}
