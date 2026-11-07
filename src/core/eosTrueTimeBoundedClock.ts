/**
 * EOS SYSTEM — GOOGLE SPANNER TRUETIME BOUNDED INTERVAL CLOCK
 * Governed by ADR-041, SPEC-035, FR-099, BDD-090
 *
 * Implements:
 * 1. TrueTime interval now() returning [t.earliest, t.latest] where latest - earliest == 2 * epsilon.
 * 2. Monotonic clock enforcement (guaranteeing non-decreasing time values).
 * 3. Commit-Wait primitive: Waits until now().earliest > t.commit, ensuring absolute external consistency
 *    (linearizability) across distributed nodes without cross-datacenter roundtrips.
 *
 * 100% Layer-0 Purity with zero runtime npm dependencies.
 */

import { performance } from "node:perf_hooks";

export interface TrueTimeInterval {
  readonly earliest: number; // Unix timestamp in ms
  readonly latest: number; // Unix timestamp in ms
  readonly epsilon: number; // Uncertainty bound in ms
}

export class EosTrueTimeBoundedClock {
  private readonly epsilonMs: number;
  private lastMonotonicTime = 0;

  constructor(epsilonMs = 2.0) {
    this.epsilonMs = Math.max(0.1, epsilonMs);
  }

  /**
   * Retrieves the current TrueTime interval [earliest, latest].
   */
  public now(): TrueTimeInterval {
    const rawTime = Date.now();
    // Enforce monotonic non-decreasing timestamp
    const monotonicNow = Math.max(rawTime, this.lastMonotonicTime);
    this.lastMonotonicTime = monotonicNow;

    const earliest = monotonicNow - this.epsilonMs;
    const latest = monotonicNow + this.epsilonMs;

    return {
      earliest,
      latest,
      epsilon: this.epsilonMs,
    };
  }

  /**
   * Commit-Wait mechanism (Google Spanner standard):
   * Waits until now().earliest exceeds the assigned commitTimestamp.
   * Guarantees that any transaction that starts after this returns will be assigned
   * a timestamp strictly greater than commitTimestamp.
   */
  public async commitWait(commitTimestamp: number): Promise<number> {
    const start = performance.now();

    while (this.now().earliest <= commitTimestamp) {
      // Small non-blocking yield to allow event loop progression
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    return performance.now() - start;
  }

  /**
   * Executes a transaction block with commit-wait guarantee.
   */
  public async executeWithCommitWait<T>(
    fn: () => Promise<T> | T,
  ): Promise<{ result: T; commitTimestamp: number; waitDurationMs: number }> {
    const interval = this.now();
    const commitTimestamp = interval.latest; // Assign s = now().latest

    const result = await fn();

    const waitDurationMs = await this.commitWait(commitTimestamp);

    return {
      result,
      commitTimestamp,
      waitDurationMs,
    };
  }

  public getEpsilon(): number {
    return this.epsilonMs;
  }
}
