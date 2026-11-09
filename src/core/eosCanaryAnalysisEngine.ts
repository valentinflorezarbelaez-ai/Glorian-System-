/**
 * EOS SYSTEM — CANARY ANALYSIS ENGINE (Layer 0)
 * Governed by SPEC-156 (Netflix Kayenta statistical canary analysis)
 *
 * Compares canary metrics against a baseline using:
 * - Mann-Whitney U rank-sum test (non-parametric, no normality assumption)
 * - Per-metric verdict: PASS / MARGINAL / FAIL
 * - Composite canary score with hard/soft/marginal metric classification
 *
 * Zero external dependencies.
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type MetricVerdict = "PASS" | "MARGINAL" | "FAIL";
export type CanaryVerdict = "PASS" | "MARGINAL" | "FAIL";

export interface CanaryMetricConfig {
  readonly name: string;
  readonly importance: "HARD" | "SOFT" | "MARGINAL";
  readonly upperBound?: number;
  readonly lowerBound?: number;
}

export interface MetricComparison {
  readonly name: string;
  readonly importance: string;
  readonly baselineMean: number;
  readonly canaryMean: number;
  readonly delta: number;
  readonly deltaPercent: number;
  readonly mannWhitneyP: number;
  readonly verdict: MetricVerdict;
}

export interface CanaryAnalysisResult {
  readonly verdict: CanaryVerdict;
  readonly canaryScore: number; // 0-100
  readonly metrics: readonly MetricComparison[];
  readonly hardFailCount: number;
  readonly softFailCount: number;
  readonly sha256Receipt: string;
}

export class EosCanaryAnalysisEngine {
  /**
   * Analyzes canary vs baseline samples per metric config.
   */
  analyze(
    baseline: Record<string, number[]>,
    canary: Record<string, number[]>,
    configs: readonly CanaryMetricConfig[],
  ): CanaryAnalysisResult {
    const comparisons: MetricComparison[] = [];

    for (const cfg of configs) {
      const b = baseline[cfg.name] ?? [];
      const c = canary[cfg.name] ?? [];
      if (b.length === 0 || c.length === 0) {
        comparisons.push({
          name: cfg.name,
          importance: cfg.importance,
          baselineMean: 0,
          canaryMean: 0,
          delta: 0,
          deltaPercent: 0,
          mannWhitneyP: 1,
          verdict: "PASS",
        });
        continue;
      }

      const bMean = b.reduce((s, v) => s + v, 0) / b.length;
      const cMean = c.reduce((s, v) => s + v, 0) / c.length;
      const delta = cMean - bMean;
      const deltaPct = bMean !== 0 ? (delta / Math.abs(bMean)) * 100 : 0;

      // Approximate Mann-Whitney U p-value (using normal approximation for large samples)
      const pValue = this.mannWhitneyApprox(b, c);

      let verdict: MetricVerdict;
      if (cfg.upperBound !== undefined && cMean > cfg.upperBound) verdict = "FAIL";
      else if (cfg.lowerBound !== undefined && cMean < cfg.lowerBound) verdict = "FAIL";
      else if (pValue < 0.01 && Math.abs(deltaPct) > 10) verdict = cfg.importance === "HARD" ? "FAIL" : "MARGINAL";
      else if (pValue < 0.05 && Math.abs(deltaPct) > 5) verdict = "MARGINAL";
      else verdict = "PASS";

      comparisons.push({
        name: cfg.name,
        importance: cfg.importance,
        baselineMean: Math.round(bMean * 1000) / 1000,
        canaryMean: Math.round(cMean * 1000) / 1000,
        delta: Math.round(delta * 1000) / 1000,
        deltaPercent: Math.round(deltaPct * 100) / 100,
        mannWhitneyP: Math.round(pValue * 100000) / 100000,
        verdict,
      });
    }

    const hardFailCount = comparisons.filter((m) => m.importance === "HARD" && m.verdict === "FAIL").length;
    const softFailCount = comparisons.filter((m) => m.importance === "SOFT" && m.verdict === "FAIL").length;
    const marginalCount = comparisons.filter((m) => m.verdict === "MARGINAL").length;

    const canaryScore = Math.max(0, 100 - hardFailCount * 40 - softFailCount * 15 - marginalCount * 5);
    const overallVerdict: CanaryVerdict =
      hardFailCount > 0 ? "FAIL" : softFailCount > 0 || marginalCount > 2 ? "MARGINAL" : "PASS";

    const canonical = JSON.stringify({ verdict: overallVerdict, canaryScore, comparisons: comparisons.length });

    return deepFreeze({
      verdict: overallVerdict,
      canaryScore,
      metrics: comparisons,
      hardFailCount,
      softFailCount,
      sha256Receipt: pureSha256(canonical),
    });
  }

  /**
   * Mann-Whitney U normal approximation.
   */
  private mannWhitneyApprox(a: number[], b: number[]): number {
    const combined = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
    let rankSumA = 0;
    for (let i = 0; i < combined.length; i++) {
      if (combined[i].g === 0) rankSumA += i + 1;
    }
    const n1 = a.length,
      n2 = b.length;
    const U = rankSumA - (n1 * (n1 + 1)) / 2;
    const mu = (n1 * n2) / 2;
    const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    if (sigma === 0) return 1;
    const z = Math.abs((U - mu) / sigma);
    // Two-tailed p-value approximation
    return Math.max(0, 2 * (1 - this.normalCDF(z)));
  }

  private normalCDF(x: number): number {
    // Abramowitz & Stegun approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.82125 + t * 1.330274))));
    if (x > 0) p = 1 - p;
    return p;
  }
}
