/**
 * EOS SYSTEM — SYNTHETIC LOAD TESTING ENGINE WITH SLA ASSERTIONS (Layer 0)
 * Governed by SPEC-149 (Google PerfKit / k6 pattern)
 *
 * Simulates concurrent request workloads against async target functions
 * and asserts SLA percentiles (p50, p95, p99) and throughput.
 *
 * Zero external dependencies.
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoadTestConfig {
  readonly concurrency: number; // Parallel workers
  readonly totalRequests: number; // Total synthetic requests
  readonly rampUpMs: number; // Gradual ramp-up duration
  readonly timeoutMs: number; // Per-request deadline
}

export interface LatencyPercentiles {
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly minMs: number;
  readonly meanMs: number;
}

export interface SLAAssertion {
  readonly metric: "p50" | "p95" | "p99" | "throughput" | "errorRate";
  readonly maxAllowed: number;
  readonly actual: number;
  readonly passed: boolean;
}

export interface LoadTestReport {
  readonly config: LoadTestConfig;
  readonly totalRequests: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly errorRate: number;
  readonly durationMs: number;
  readonly throughputRps: number;
  readonly latency: LatencyPercentiles;
  readonly slaAssertions: readonly SLAAssertion[];
  readonly allSLAPassed: boolean;
  readonly sha256Receipt: string;
}

export type RequestFn = () => Promise<void> | void;

/**
 * Wall-clock source for latency measurement. Injectable so SLA assertions can
 * be verified deterministically instead of racing a loaded scheduler.
 */
export type LoadTestClock = () => number;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class EosLoadTestEngine {
  private readonly now: LoadTestClock;

  constructor(now: LoadTestClock = () => performance.now()) {
    this.now = now;
  }

  /**
   * Executes a synthetic load test against a target function.
   */
  async run(
    targetFn: RequestFn,
    config: LoadTestConfig,
    slaThresholds?: Partial<Record<SLAAssertion["metric"], number>>,
  ): Promise<LoadTestReport> {
    const latencies: number[] = [];
    let successCount = 0;
    let errorCount = 0;
    const startTime = this.now();

    // Shared cursor for distributing work among concurrent workers
    const shared = { cursor: 0 };
    const promises: Promise<void>[] = [];
    for (let w = 0; w < config.concurrency; w++) {
      promises.push(
        this.runWorker(
          targetFn,
          config,
          shared,
          latencies,
          () => {
            successCount++;
          },
          () => {
            errorCount++;
          },
        ),
      );
    }
    await Promise.all(promises);

    const durationMs = Math.round(this.now() - startTime);
    const sorted = [...latencies].sort((a, b) => a - b);
    const throughputRps = Math.round((config.totalRequests / durationMs) * 1000 * 100) / 100;

    const latency = this.computePercentiles(sorted);
    const errorRate = Math.round((errorCount / config.totalRequests) * 10000) / 100;

    const assertions = this.evaluateSLA(latency, throughputRps, errorRate, slaThresholds ?? {});
    const allPassed = assertions.every((a) => a.passed);

    const canonical = JSON.stringify({
      totalRequests: config.totalRequests,
      successCount,
      errorCount,
      durationMs,
      allPassed,
    });

    return deepFreeze({
      config,
      totalRequests: config.totalRequests,
      successCount,
      errorCount,
      errorRate,
      durationMs,
      throughputRps,
      latency,
      slaAssertions: assertions,
      allSLAPassed: allPassed,
      sha256Receipt: pureSha256(canonical),
    });
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async runWorker(
    fn: RequestFn,
    config: LoadTestConfig,
    shared: { cursor: number },
    latencies: number[],
    onSuccess: () => void,
    onError: () => void,
  ): Promise<void> {
    while (shared.cursor < config.totalRequests) {
      const idx = shared.cursor++;
      // Ramp-up
      if (config.rampUpMs > 0) {
        const delay = (idx / config.totalRequests) * config.rampUpMs;
        if (delay > 0 && idx % config.concurrency === 0) {
          await new Promise((r) => setTimeout(r, Math.min(delay / config.concurrency, 10)));
        }
      }

      const start = this.now();
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout =
          config.timeoutMs > 0
            ? Promise.race([
                Promise.resolve(fn()),
                new Promise((_, rej) => {
                  timeoutHandle = setTimeout(() => rej(new Error("TIMEOUT")), config.timeoutMs);
                }),
              ])
            : Promise.resolve(fn());
        await timeout;
        onSuccess();
      } catch {
        onError();
      } finally {
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      }
      latencies.push(Math.round(this.now() - start));
    }
  }

  private computePercentiles(sorted: number[]): LatencyPercentiles {
    if (sorted.length === 0) return { p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, minMs: 0, meanMs: 0 };
    const pct = (p: number) => sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      p50Ms: pct(0.5),
      p95Ms: pct(0.95),
      p99Ms: pct(0.99),
      maxMs: sorted[sorted.length - 1],
      minMs: sorted[0],
      meanMs: Math.round(sum / sorted.length),
    };
  }

  private evaluateSLA(
    latency: LatencyPercentiles,
    throughput: number,
    errorRate: number,
    thresholds: Partial<Record<SLAAssertion["metric"], number>>,
  ): SLAAssertion[] {
    const assertions: SLAAssertion[] = [];
    if (thresholds.p50 !== undefined)
      assertions.push({
        metric: "p50",
        maxAllowed: thresholds.p50,
        actual: latency.p50Ms,
        passed: latency.p50Ms <= thresholds.p50,
      });
    if (thresholds.p95 !== undefined)
      assertions.push({
        metric: "p95",
        maxAllowed: thresholds.p95,
        actual: latency.p95Ms,
        passed: latency.p95Ms <= thresholds.p95,
      });
    if (thresholds.p99 !== undefined)
      assertions.push({
        metric: "p99",
        maxAllowed: thresholds.p99,
        actual: latency.p99Ms,
        passed: latency.p99Ms <= thresholds.p99,
      });
    if (thresholds.throughput !== undefined)
      assertions.push({
        metric: "throughput",
        maxAllowed: 0,
        actual: throughput,
        passed: throughput >= thresholds.throughput,
      });
    if (thresholds.errorRate !== undefined)
      assertions.push({
        metric: "errorRate",
        maxAllowed: thresholds.errorRate,
        actual: errorRate,
        passed: errorRate <= thresholds.errorRate,
      });
    return assertions;
  }
}
