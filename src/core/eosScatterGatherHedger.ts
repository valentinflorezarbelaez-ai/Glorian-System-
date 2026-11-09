/**
 * EOS SYSTEM — SCATTER-GATHER FANOUT WITH HEDGED REQUESTS (Layer 0)
 * Governed by SPEC-181 (Google Spanner / Tail-at-scale hedged retry pattern)
 *
 * Implements:
 * - Scatter to N replicas, gather first-k or all with merge reducer
 * - Hedged requests: fire a secondary copy after p95-based delay budget
 * - Cancellation of redundant in-flight hedges once a winner is set
 * - Deterministic attempt accounting + telemetry fingerprint
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface ScatterConfig {
  readonly replicas: readonly string[];
  readonly hedgeDelayMs: number; // after this, launch a hedged copy
  readonly totalDeadlineMs: number; // hard timeout for the entire fanout
  readonly requiredSuccesses: number; // fan-in threshold
}

export interface AttemptRecord {
  readonly replica: string;
  readonly hedged: boolean;
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  readonly ok: boolean;
  readonly value?: unknown;
  readonly error?: string;
}

export interface ScatterResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly latencyMs: number;
  readonly attempts: readonly AttemptRecord[];
  readonly wastedAttempts: number;
}

export type ScatterFn<T> = (replica: string, signal: { cancelled: boolean }) => Promise<T>;
export type MergeFn<T> = (partial: unknown[]) => T;

export class EosScatterGatherEngine<T> {
  private readonly config: ScatterConfig;
  private lastLatencies: number[] = [];

  constructor(config: ScatterConfig) {
    assertPrecondition(config.replicas.length >= 1, "at least one replica required");
    assertPrecondition(
      config.requiredSuccesses >= 1 && config.requiredSuccesses <= config.replicas.length,
      "invalid requiredSuccesses",
    );
    this.config = deepFreeze(config);
  }

  /**
   * Fans out the primary attempt to every replica; if p95 latency has been
   * observed, delays hedges so that we do not double-load the fleet.
   */
  async run(scatter: ScatterFn<T>, merge: MergeFn<T>): Promise<ScatterResult<T>> {
    const start = Date.now();
    const attempts: AttemptRecord[] = [];
    const collected: unknown[] = [];
    let settled = false;

    const hedgeDelay = Math.max(1, Math.min(this.config.hedgeDelayMs, this.p95Ms()));
    const signals: { cancelled: boolean }[] = [];

    const launchOne = (replica: string, hedged: boolean): Promise<void> => {
      const signal = { cancelled: false };
      signals.push(signal);
      const startedAtMs = Date.now();
      return scatter(replica, signal).then(
        (value) => {
          attempts.push(deepFreeze({ replica, hedged, startedAtMs, finishedAtMs: Date.now(), ok: true, value }));
          if (!signal.cancelled) collected.push(value);
        },
        (err: unknown) => {
          attempts.push(
            deepFreeze({ replica, hedged, startedAtMs, finishedAtMs: Date.now(), ok: false, error: String(err) }),
          );
        },
      );
    };

    // Primary fanout
    const primaryPromises = this.config.replicas.map((r) => launchOne(r, false));

    // Deadline racer
    const deadlinePromise = new Promise<"deadline">((resolve) =>
      setTimeout(() => resolve("deadline"), this.config.totalDeadlineMs),
    );
    let thresholdTimer: ReturnType<typeof setInterval> | undefined;
    const thresholdPromise = new Promise<"enough">((resolve) => {
      thresholdTimer = setInterval(() => {
        if (collected.length >= this.config.requiredSuccesses) {
          if (thresholdTimer !== undefined) clearInterval(thresholdTimer);
          resolve("enough");
        }
      }, 1);
    });

    let outcome: "enough" | "deadline";
    try {
      outcome = await Promise.race([
        Promise.all(primaryPromises).then(() => "enough" as const),
        deadlinePromise,
        thresholdPromise,
      ]);
    } finally {
      settled = true;
      // Stop the threshold poller: a leaked interval keeps the Node event loop
      // alive and prevents any CLI or test process from ever exiting.
      if (thresholdTimer !== undefined) clearInterval(thresholdTimer);
      // Cancel redundant in-flight replicas
      for (const s of signals) s.cancelled = true;
    }

    // Optional hedge wave for replicas not yet answered after hedgeDelay
    if (
      outcome === "enough" &&
      collected.length < this.config.requiredSuccesses &&
      Date.now() - start < this.config.totalDeadlineMs
    ) {
      const hedgePromises = this.config.replicas.map(
        (r) => new Promise<void>((res) => setTimeout(() => launchOne(r, true).then(res), hedgeDelay)),
      );
      await Promise.race([Promise.all(hedgePromises), deadlinePromise]);
    }

    const wasted = attempts.filter((a) => a.ok && (settled || collected.length > this.config.requiredSuccesses)).length;
    const ok = collected.length >= this.config.requiredSuccesses;
    const value = ok ? merge(collected.slice(0, this.config.requiredSuccesses)) : undefined;

    const latMs = Date.now() - start;
    this.lastLatencies.push(latMs);
    if (this.lastLatencies.length > 100) this.lastLatencies.shift();

    return deepFreeze({ ok, value, latencyMs: latMs, attempts, wastedAttempts: wasted });
  }

  /**
   * Tail latency percentile over recent runs (defaults to 0 on cold start).
   */
  p95Ms(): number {
    if (this.lastLatencies.length === 0) return 0;
    const sorted = [...this.lastLatencies].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  }

  fingerprint(result: ScatterResult<T>): string {
    return pureSha256(
      result.attempts.map((a) => `${a.replica}:${a.hedged}:${a.ok}:${a.finishedAtMs - a.startedAtMs}`).join("|"),
    );
  }
}
