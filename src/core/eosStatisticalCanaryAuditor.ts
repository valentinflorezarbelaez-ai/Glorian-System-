/**
 * EOS SYSTEM — ZERO-DEPENDENCY AUTOMATED STATISTICAL CANARY AUDITOR (Layer 0)
 * Governed by SPEC-066, CHANGE-059, ADR-071, FR-226..FR-229, BDD-207..BDD-208 (v67.0.0)
 *
 * Implements Netflix Kayenta & Google Borg Nonparametric Statistical Hypothesis Testing
 * using the Mann-Whitney U (Wilcoxon Rank-Sum) test with tied-rank correction and
 * continuity-adjusted normal approximation for automated canary rollback/promotion.
 *
 * Zero external runtime npm dependencies (Law V). Node 24 strip-only compliant.
 */

import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export interface MannWhitneyUResult {
  readonly uStatistic: number;
  readonly u1: number;
  readonly u2: number;
  readonly zScore: number;
  readonly pValue: number;
  readonly baselineMedian: number;
  readonly canaryMedian: number;
  readonly sampleSizeBaseline: number;
  readonly sampleSizeCanary: number;
}

export type CanaryAuditVerdict = "CANARY_PASS_OPTIMAL" | "CANARY_ROLLBACK_REQUIRED";

export interface CanaryAuditReport {
  readonly metricName: string;
  readonly verdict: CanaryAuditVerdict;
  readonly isStatisticallySignificant: boolean;
  readonly regressionDetected: boolean;
  readonly statistics: MannWhitneyUResult;
  readonly evaluatedAtIso: string;
  readonly sha256Receipt: string;
}

/**
 * High-precision complementary error function erfc(x)
 * using Abramowitz & Stegun approximation (formula 7.1.26).
 */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1.0 / (1.0 + 0.5 * z);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t *
                                      (-0.82215223 +
                                        t * 0.17087277))))))))
    );
  return x >= 0 ? ans : 2.0 - ans;
}

/**
 * Computes the two-tailed p-value from a Z-score using standard normal distribution.
 */
function zToTwoTailedPValue(z: number): number {
  return erfc(Math.abs(z) / Math.SQRT2);
}

/**
 * Calculates median of an array of numbers.
 */
function computeMedian(arr: readonly number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class EosStatisticalCanaryAuditor {
  /**
   * Executes the Mann-Whitney U rank-sum test between baseline and canary metric samples.
   */
  public static runMannWhitneyUTest(
    baseline: readonly number[],
    canary: readonly number[]
  ): MannWhitneyUResult {
    assertPrecondition(baseline.length >= 3, "Baseline sample size must be >= 3");
    assertPrecondition(canary.length >= 3, "Canary sample size must be >= 3");

    const n1 = baseline.length;
    const n2 = canary.length;

    // Combine samples and track group origin (0 = baseline, 1 = canary)
    interface ScoredItem {
      readonly value: number;
      readonly group: 0 | 1;
      readonly originalIndex: number;
    }

    const combined: ScoredItem[] = [
      ...baseline.map((v, i) => ({ value: v, group: 0 as const, originalIndex: i })),
      ...canary.map((v, i) => ({ value: v, group: 1 as const, originalIndex: i }))
    ];

    // Sort ascending
    combined.sort((a, b) => a.value - b.value);

    // Assign fractional ranks for ties
    const ranks: number[] = new Array(combined.length);
    let i = 0;
    while (i < combined.length) {
      let j = i;
      while (j < combined.length - 1 && combined[j + 1].value === combined[j].value) {
        j++;
      }
      const tiedCount = j - i + 1;
      // Average rank for 1-based indexing
      const rankAverage = i + 1 + (tiedCount - 1) / 2.0;
      for (let k = i; k <= j; k++) {
        ranks[k] = rankAverage;
      }
      i = j + 1;
    }

    // Sum ranks for baseline (R1)
    let r1 = 0;
    for (let k = 0; k < combined.length; k++) {
      if (combined[k].group === 0) {
        r1 += ranks[k];
      }
    }

    // Calculate U statistics
    const u1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - r1;
    const u2 = n1 * n2 - u1;
    const uStat = Math.min(u1, u2);

    // Mean and Standard Deviation of U
    const meanU = (n1 * n2) / 2;
    const varianceU = (n1 * n2 * (n1 + n2 + 1)) / 12;
    const stdDevU = Math.sqrt(varianceU);

    // Continuity-corrected Z-score
    const zScore = stdDevU > 0 ? (Math.abs(uStat - meanU) - 0.5) / stdDevU : 0;
    const pValue = Math.min(1.0, Math.max(0.0, zToTwoTailedPValue(zScore)));

    const baselineMedian = computeMedian(baseline);
    const canaryMedian = computeMedian(canary);

    return deepFreeze({
      uStatistic: uStat,
      u1,
      u2,
      zScore: Number(zScore.toFixed(4)),
      pValue: Number(pValue.toFixed(6)),
      baselineMedian,
      canaryMedian,
      sampleSizeBaseline: n1,
      sampleSizeCanary: n2
    });
  }

  /**
   * Audits a canary rollout metric (e.g. latency, error rate) against baseline
   * and renders an automated promote/rollback verdict.
   */
  public static auditCanaryMetric(
    metricName: string,
    baseline: readonly number[],
    canary: readonly number[],
    significanceThreshold = 0.05
  ): CanaryAuditReport {
    const stats = this.runMannWhitneyUTest(baseline, canary);

    // Regression occurs if the difference is statistically significant (p < threshold)
    // AND the canary median is worse (higher) than baseline median.
    const isStatisticallySignificant = stats.pValue < significanceThreshold;
    const regressionDetected = isStatisticallySignificant && stats.canaryMedian > stats.baselineMedian;

    const verdict: CanaryAuditVerdict = regressionDetected
      ? "CANARY_ROLLBACK_REQUIRED"
      : "CANARY_PASS_OPTIMAL";

    const evaluatedAtIso = new Date().toISOString();
    const payloadForReceipt = JSON.stringify({
      metricName,
      verdict,
      isStatisticallySignificant,
      regressionDetected,
      stats,
      evaluatedAtIso
    });
    const sha256Receipt = pureSha256(payloadForReceipt);

    return deepFreeze({
      metricName,
      verdict,
      isStatisticallySignificant,
      regressionDetected,
      statistics: stats,
      evaluatedAtIso,
      sha256Receipt
    });
  }

  /**
   * Persists an audit report into the Durable SQLite WAL ledger.
   */
  public static recordAuditInLedger(
    report: CanaryAuditReport,
    ledgerPath?: string
  ): { readonly recorded: boolean; readonly receiptHash: string } {
    const ledger = new EosDurableSqliteLedger(ledgerPath || ":memory:");
    try {
      const entry = ledger.appendEntry({
        category: "SECURITY_AUDIT",
        projectId: "eos-system",
        title: `Automated Canary Analysis: ${report.metricName} -> ${report.verdict}`,
        payload: {
          metricName: report.metricName,
          verdict: report.verdict,
          pValue: report.statistics.pValue,
          baselineMedian: report.statistics.baselineMedian,
          canaryMedian: report.statistics.canaryMedian,
          sha256Receipt: report.sha256Receipt
        }
      });
      return { recorded: true, receiptHash: entry.entryHash };
    } finally {
      ledger.close();
    }
  }
}
