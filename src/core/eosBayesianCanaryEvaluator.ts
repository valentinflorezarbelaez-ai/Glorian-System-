/**
 * EOS Sovereign Architecture - Layer 0
 * Bayesian Dynamic Canary Evaluation & Automated Rollback Gateway
 * SPEC-280 / CHANGE-142
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";

export interface CanaryTelemetryGroup {
  requestCount: number;
  errorCount: number;
  latencySamplesMs: number[];
  cpuUtilization?: number;
  memoryUtilization?: number;
}

export interface CanaryThresholds {
  maxErrorRateDelta?: number; // default 0.01 (1%)
  maxP99LatencyShift?: number; // default 0.20 (20%)
  passScoreThreshold?: number; // default 85.0
  marginalScoreThreshold?: number; // default 70.0
}

export interface CanaryEvaluationDataset {
  serviceName: string;
  deploymentId?: string;
  baselineRevision?: string;
  canaryRevision?: string;
  baseline: CanaryTelemetryGroup;
  canary: CanaryTelemetryGroup;
  thresholds?: CanaryThresholds;
  evidencePath?: string;
}

export interface DistributionMetrics {
  sampleCount: number;
  meanMs: number;
  stdDevMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
}

export type BayesianCanaryVerdict = "PASS" | "MARGINAL" | "ROLLBACK_TRIGGERED";

export interface RollbackManifest {
  action: "INSTANT_TRAFFIC_DRAIN_AND_REVERT";
  serviceName: string;
  targetRevision: string;
  failedRevision: string;
  reasons: string[];
  timestamp: string;
}

export interface CanaryEvaluationReport {
  status: "COMPLETED" | "ERROR";
  serviceName: string;
  verdict: BayesianCanaryVerdict;
  compositeScore: number;
  rollbackRequired: boolean;
  baselineMetrics: DistributionMetrics;
  canaryMetrics: DistributionMetrics;
  deltaP99: number;
  deltaErrorRate: number;
  failureReasons: string[];
  rollbackManifest?: RollbackManifest;
  sha256Receipt?: string;
  errors?: string[];
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export class EosBayesianCanaryEvaluator {
  public static computeDistributionMetrics(group: CanaryTelemetryGroup): DistributionMetrics {
    const samples = Array.isArray(group?.latencySamplesMs) ? group.latencySamplesMs : [];
    const count = samples.length;

    if (count === 0) {
      const errorRate = group?.requestCount > 0 ? group.errorCount / group.requestCount : 0;
      return {
        sampleCount: 0,
        meanMs: 0,
        stdDevMs: 0,
        p50Ms: 0,
        p90Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        errorRate: Number(errorRate.toFixed(4)),
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    let sum = 0;
    for (const val of sorted) sum += val;
    const mean = sum / count;

    let varSum = 0;
    for (const val of sorted) {
      const diff = val - mean;
      varSum += diff * diff;
    }
    const variance = varSum / count;
    const stdDev = Math.sqrt(variance);

    const errorRate = group.requestCount > 0 ? group.errorCount / group.requestCount : 0;

    return {
      sampleCount: count,
      meanMs: Number(mean.toFixed(2)),
      stdDevMs: Number(stdDev.toFixed(2)),
      p50Ms: Number(calculatePercentile(sorted, 50).toFixed(2)),
      p90Ms: Number(calculatePercentile(sorted, 90).toFixed(2)),
      p95Ms: Number(calculatePercentile(sorted, 95).toFixed(2)),
      p99Ms: Number(calculatePercentile(sorted, 99).toFixed(2)),
      errorRate: Number(errorRate.toFixed(4)),
    };
  }

  public static evaluateCanary(
    dataset: CanaryEvaluationDataset | string,
    evidencePathOverride?: string,
  ): CanaryEvaluationReport {
    try {
      const data: CanaryEvaluationDataset = typeof dataset === "string" ? JSON.parse(dataset) : dataset;

      if (!data || !data.baseline || !data.canary) {
        throw new Error("Invalid canary dataset: missing baseline or canary group");
      }

      const thresholds: Required<CanaryThresholds> = {
        maxErrorRateDelta: data.thresholds?.maxErrorRateDelta ?? 0.01,
        maxP99LatencyShift: data.thresholds?.maxP99LatencyShift ?? 0.2,
        passScoreThreshold: data.thresholds?.passScoreThreshold ?? 85.0,
        marginalScoreThreshold: data.thresholds?.marginalScoreThreshold ?? 70.0,
      };

      const baselineMetrics = this.computeDistributionMetrics(data.baseline);
      const canaryMetrics = this.computeDistributionMetrics(data.canary);

      const baselineP99 = Math.max(1, baselineMetrics.p99Ms);
      const rawDeltaP99 = (canaryMetrics.p99Ms - baselineMetrics.p99Ms) / baselineP99;
      const deltaP99 = Number(rawDeltaP99.toFixed(4));

      const rawDeltaError = canaryMetrics.errorRate - baselineMetrics.errorRate;
      const deltaErrorRate = Number(rawDeltaError.toFixed(4));

      let score = 100.0;
      if (deltaErrorRate > 0) score -= deltaErrorRate * 2000;
      if (deltaP99 > 0) score -= deltaP99 * 100;
      score = Math.max(0, Math.min(100, Number(score.toFixed(2))));

      const failureReasons: string[] = [];
      if (deltaErrorRate > thresholds.maxErrorRateDelta) {
        failureReasons.push("ERROR_RATE_REGRESSION");
      }
      if (deltaP99 > thresholds.maxP99LatencyShift) {
        failureReasons.push("P99_LATENCY_REGRESSION");
      }
      if (score < thresholds.marginalScoreThreshold) {
        failureReasons.push("COMPOSITE_SCORE_CRITICAL");
      }

      let verdict: BayesianCanaryVerdict = "PASS";
      if (failureReasons.length > 0 || score < thresholds.marginalScoreThreshold) {
        verdict = "ROLLBACK_TRIGGERED";
      } else if (score < thresholds.passScoreThreshold) {
        verdict = "MARGINAL";
      }

      const rollbackRequired = verdict === "ROLLBACK_TRIGGERED";
      let rollbackManifest: RollbackManifest | undefined;

      if (rollbackRequired) {
        rollbackManifest = {
          action: "INSTANT_TRAFFIC_DRAIN_AND_REVERT",
          serviceName: data.serviceName,
          targetRevision: data.baselineRevision || "previous-stable",
          failedRevision: data.canaryRevision || "current-canary",
          reasons: failureReasons,
          timestamp: new Date().toISOString(),
        };
      }

      const evidencePath = evidencePathOverride ?? data.evidencePath ?? resolveEvidencePath("CANARY_RECEIPT.json");

      const partialReport: CanaryEvaluationReport = {
        status: "COMPLETED",
        serviceName: data.serviceName,
        verdict,
        compositeScore: score,
        rollbackRequired,
        baselineMetrics,
        canaryMetrics,
        deltaP99,
        deltaErrorRate,
        failureReasons,
        rollbackManifest,
      };

      const receiptPayload = {
        schemaVersion: "1.0.0",
        timestamp: new Date().toISOString(),
        report: partialReport,
      };

      const content = JSON.stringify(receiptPayload, null, 2);
      const sha256 = crypto.createHash("sha256").update(content).digest("hex");
      const sealed = { ...receiptPayload, evidenceSha256: sha256 };

      const dir = path.dirname(evidencePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(evidencePath, JSON.stringify(sealed, null, 2), "utf8");

      return {
        ...partialReport,
        sha256Receipt: sha256,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: "ERROR",
        serviceName: "unknown",
        verdict: "ROLLBACK_TRIGGERED",
        compositeScore: 0,
        rollbackRequired: true,
        baselineMetrics: this.computeDistributionMetrics({
          requestCount: 0,
          errorCount: 0,
          latencySamplesMs: [],
        }),
        canaryMetrics: this.computeDistributionMetrics({
          requestCount: 0,
          errorCount: 0,
          latencySamplesMs: [],
        }),
        deltaP99: 0,
        deltaErrorRate: 0,
        failureReasons: ["INGESTION_ERROR"],
        errors: [msg],
      };
    }
  }
}
