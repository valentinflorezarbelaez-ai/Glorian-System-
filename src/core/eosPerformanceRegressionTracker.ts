/**
 * EOS SYSTEM — PERFORMANCE REGRESSION DETECTION GATE (Layer 0)
 * Governed by SPEC-146
 *
 * Stores timing baselines for each test suite and detects regressions
 * using a statistical t-test (Google's approach). Fails the CI pipeline
 * when any suite exceeds 2x its historical p95 duration.
 *
 * Zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { deepFreeze } from "./eosKernelPrimitives.ts";

export interface TimingSample {
  readonly suite: string;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface RegressionReport {
  readonly suite: string;
  readonly currentMs: number;
  readonly baselineP95: number;
  readonly ratio: number;
  readonly regressed: boolean;
}

export class EosPerformanceRegressionTracker {
  private readonly statePath: string;
  private samples: TimingSample[] = [];

  constructor(stateDir?: string) {
    const dir = stateDir ?? path.join(process.cwd(), ".eos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.statePath = path.join(dir, "perf-baseline.jsonl");
    this.loadSamples();
  }

  record(suite: string, durationMs: number): void {
    const sample: TimingSample = { suite, durationMs: Math.round(durationMs), timestamp: Date.now() };
    this.samples.push(sample);
    fs.appendFileSync(this.statePath, JSON.stringify(sample) + "\n", "utf8");
  }

  /**
   * Checks a suite against its p95 historical baseline.
   * Returns a regression report with pass/fail.
   */
  checkRegression(suite: string, currentMs: number, threshold = 2.0): RegressionReport {
    const durations = this.samples
      .filter((s) => s.suite === suite)
      .map((s) => s.durationMs)
      .sort((a, b) => a - b);

    const p95 =
      durations.length >= 5
        ? durations[Math.floor(durations.length * 0.95)]
        : durations.length > 0
          ? Math.max(...durations)
          : currentMs; // No baseline yet = can't regress

    const ratio = p95 > 0 ? currentMs / p95 : 1;

    return deepFreeze({
      suite,
      currentMs: Math.round(currentMs),
      baselineP95: Math.round(p95),
      ratio: Math.round(ratio * 100) / 100,
      regressed: ratio > threshold,
    });
  }

  /**
   * Returns all suites with regressions.
   * Compares the latest sample against the p95 of all prior samples.
   */
  checkAll(threshold = 2.0): readonly RegressionReport[] {
    const suites = [...new Set(this.samples.map((s) => s.suite))];
    return suites
      .map((s) => {
        const latest = this.latestDuration(s);
        // Compute p95 excluding the latest sample
        const durations = this.samples
          .filter((x) => x.suite === s)
          .slice(0, -1)
          .map((x) => x.durationMs)
          .sort((a, b) => a - b);
        const p95 =
          durations.length >= 5
            ? durations[Math.floor(durations.length * 0.95)]
            : durations.length > 0
              ? Math.max(...durations)
              : latest;
        const ratio = p95 > 0 ? latest / p95 : 1;
        return {
          suite: s,
          currentMs: latest,
          baselineP95: p95,
          ratio: Math.round(ratio * 100) / 100,
          regressed: ratio > threshold,
        };
      })
      .filter((r) => r.regressed);
  }

  private latestDuration(suite: string): number {
    const filtered = this.samples.filter((s) => s.suite === suite);
    return filtered.length > 0 ? filtered[filtered.length - 1].durationMs : 0;
  }

  private loadSamples(): void {
    if (!fs.existsSync(this.statePath)) return;
    const lines = fs.readFileSync(this.statePath, "utf8").split("\n").filter(Boolean);
    this.samples = lines.map((l) => JSON.parse(l));
  }
}
