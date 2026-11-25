/**
 * EOS SYSTEM — PERFORMANCE REGRESSION DETECTION GATE (Layer 0)
 * Governed by SPEC-146
 *
 * Stores timing baselines for each test suite and detects regressions
 * by comparing the latest duration to prior observations of the same suite.
 * CI reports performance findings as advisory.
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

export interface PerformanceSummary {
  readonly status: "INSUFFICIENT_DATA" | "PARTIAL" | "CONFORMING" | "REGRESSIONS_DETECTED";
  readonly comparedSuites: number;
  readonly unmeasuredSuites: number;
  readonly regressions: readonly RegressionReport[];
}

// CHANGE-122 excludes measurements that may include machine hibernation.
const MAX_SAMPLE_MS = 300_000;

function historicalP95(durations: readonly number[]): number | undefined {
  const sorted = durations.filter((duration) => duration <= MAX_SAMPLE_MS).sort((a, b) => a - b);
  if (sorted.length < 5) return sorted.at(-1);
  return sorted[Math.floor(sorted.length * 0.95)];
}

function compare(suite: string, currentMs: number, p95: number | undefined, threshold: number): RegressionReport {
  const hasBaseline = p95 !== undefined && p95 > 0;
  const ratio = hasBaseline ? currentMs / p95 : 1;
  return deepFreeze({
    suite,
    currentMs: Math.round(currentMs),
    baselineP95: Math.round(p95 ?? currentMs),
    ratio: Math.round(ratio * 100) / 100,
    regressed: hasBaseline && ratio > threshold,
  });
}

function validateTiming(suite: unknown, durationMs: unknown): void {
  if (typeof suite !== "string" || !suite.trim()) throw new Error("suite must be a nonempty string");
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error("durationMs must be a finite nonnegative number");
  }
}

export class EosPerformanceRegressionTracker {
  private readonly statePath: string;
  private readonly durationsBySuite = new Map<string, number[]>();
  private needsNewline = false;

  constructor(stateDir?: string) {
    const dir = stateDir ?? path.join(process.cwd(), ".eos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.statePath = path.join(dir, "perf-baseline.jsonl");
    this.loadSamples();
  }

  record(suite: string, durationMs: number): void {
    validateTiming(suite, durationMs);
    const sample: TimingSample = { suite, durationMs: Math.round(durationMs), timestamp: Date.now() };
    fs.appendFileSync(this.statePath, (this.needsNewline ? "\n" : "") + JSON.stringify(sample) + "\n", "utf8");
    this.needsNewline = false;
    this.addDuration(suite, sample.durationMs);
  }

  checkRegression(suite: string, currentMs: number, threshold = 2.0): RegressionReport {
    return compare(suite, currentMs, historicalP95(this.durationsBySuite.get(suite) ?? []), threshold);
  }

  checkAll(threshold = 2.0, activeSuites?: ReadonlySet<string>): readonly RegressionReport[] {
    return this.summarize(threshold, activeSuites).regressions;
  }

  summarize(threshold = 2.0, activeSuites?: ReadonlySet<string>): PerformanceSummary {
    const regressions: RegressionReport[] = [];
    let comparedSuites = 0;
    for (const [suite, durations] of this.durationsBySuite) {
      if (activeSuites && !activeSuites.has(suite)) continue;
      const latest = durations[durations.length - 1];
      if (latest > MAX_SAMPLE_MS) continue;
      const p95 = historicalP95(durations.slice(0, -1));
      if (p95 === undefined || p95 === 0) continue;
      comparedSuites++;
      const report = compare(suite, latest, p95, threshold);
      if (report.regressed) regressions.push(report);
    }

    const unmeasuredSuites = (activeSuites?.size ?? this.durationsBySuite.size) - comparedSuites;
    let status: PerformanceSummary["status"] = "CONFORMING";
    if (regressions.length) status = "REGRESSIONS_DETECTED";
    else if (!comparedSuites) status = "INSUFFICIENT_DATA";
    else if (unmeasuredSuites) status = "PARTIAL";
    return deepFreeze({ status, comparedSuites, unmeasuredSuites, regressions });
  }

  private addDuration(suite: string, durationMs: number): void {
    const durations = this.durationsBySuite.get(suite);
    if (durations) durations.push(durationMs);
    else this.durationsBySuite.set(suite, [durationMs]);
  }

  private loadSamples(): void {
    let history: string;
    try {
      history = fs.readFileSync(this.statePath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    this.needsNewline = history.length > 0 && !history.endsWith("\n");
    for (const [index, line] of history.split("\n").entries()) {
      if (!line.trim()) continue;
      try {
        const sample = JSON.parse(line);
        validateTiming(sample?.suite, sample?.durationMs);
        this.addDuration(sample.suite, sample.durationMs);
      } catch (err) {
        const reason = err instanceof SyntaxError ? "invalid JSON" : String(err);
        throw new Error(`Invalid performance history at ${this.statePath}:${index + 1}: ${reason}`);
      }
    }
  }
}
