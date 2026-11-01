/**
 * EOS SYSTEM — LAYER-0 ADAPTIVE HEDGED REQUESTS & DEADLINE PROPAGATION MESH (SPEC-111)
 *
 * Implements the Google Research "The Tail at Scale" (Jeff Dean & Luiz André Barroso)
 * doctrine for tail-latency straggler mitigation, distributed deadline budget
 * propagation, cooperative cancellation, and anti-storm token bucket regulation.
 *
 * Governed by SPEC-111, PLAN-111, ADR-111.
 * 100% Layer 0 Purity — zero external runtime npm dependencies.
 */

import crypto from "node:crypto";

export interface DeadlineContext {
  readonly traceId: string;
  readonly deadlineEpochMs: number;
  getRemainingMs(now?: number): number;
  isExpired(now?: number): boolean;
}

export class EosDeadlineContext implements DeadlineContext {
  public readonly traceId: string;
  public readonly deadlineEpochMs: number;

  constructor(deadlineEpochMs: number, traceId?: string) {
    this.deadlineEpochMs = deadlineEpochMs;
    this.traceId = traceId || crypto.randomUUID();
  }

  public static fromTimeout(timeoutMs: number, traceId?: string, now = Date.now()): EosDeadlineContext {
    return new EosDeadlineContext(now + Math.max(0, timeoutMs), traceId);
  }

  public getRemainingMs(now = Date.now()): number {
    return this.deadlineEpochMs - now;
  }

  public isExpired(now = Date.now()): boolean {
    return this.getRemainingMs(now) <= 0;
  }
}

export interface EndpointPercentileStats {
  readonly sampleCount: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
}

export interface HedgedExecutionOptions<T> {
  readonly endpointId: string;
  readonly deadlineContext?: DeadlineContext;
  readonly deadlineMs?: number;
  readonly hedgingDelayMs?: number;
  readonly primaryFn: (signal: AbortSignal) => Promise<T>;
  readonly hedgedFn: (signal: AbortSignal) => Promise<T>;
}

export interface HedgedExecutionResult<T> {
  readonly result: T;
  readonly executedBy: "PRIMARY" | "HEDGED";
  readonly latencyMs: number;
  readonly hedgeDispatched: boolean;
  readonly sha256Receipt: string;
}

export interface MeshMetricsSnapshot {
  readonly totalRequests: number;
  readonly hedgedRequests: number;
  readonly hedgedRatePct: number;
  readonly shedRequests: number;
  readonly endpoints: Record<string, EndpointPercentileStats>;
  readonly sha256Receipt: string;
}

class LatencyReservoir {
  private readonly buffer: number[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 200) {
    this.maxCapacity = Math.max(20, maxCapacity);
  }

  public addSample(latencyMs: number): void {
    if (this.buffer.length >= this.maxCapacity) {
      this.buffer.shift();
    }
    this.buffer.push(Math.max(0, latencyMs));
  }

  public getStats(defaultP95 = 50): EndpointPercentileStats {
    if (this.buffer.length === 0) {
      return {
        sampleCount: 0,
        p50Ms: Math.round(defaultP95 * 0.5),
        p95Ms: defaultP95,
        p99Ms: Math.round(defaultP95 * 1.5)
      };
    }

    const sorted = [...this.buffer].sort((a, b) => a - b);
    const count = sorted.length;

    const p50Idx = Math.min(count - 1, Math.floor(count * 0.5));
    const p95Idx = Math.min(count - 1, Math.floor(count * 0.95));
    const p99Idx = Math.min(count - 1, Math.floor(count * 0.99));

    return {
      sampleCount: count,
      p50Ms: sorted[p50Idx],
      p95Ms: sorted[p95Idx],
      p99Ms: sorted[p99Idx]
    };
  }
}

export class EosAdaptiveHedgedDeadlineMesh {
  private readonly endpoints = new Map<string, LatencyReservoir>();
  private totalRequests = 0;
  private hedgedRequests = 0;
  private shedRequests = 0;
  private readonly maxHedgeRatePercent: number;
  private readonly defaultP95Ms: number;

  constructor(options?: { maxHedgeRatePercent?: number; defaultP95Ms?: number }) {
    this.maxHedgeRatePercent = Math.min(20, Math.max(1, options?.maxHedgeRatePercent ?? 5));
    this.defaultP95Ms = Math.max(5, options?.defaultP95Ms ?? 40);
  }

  /**
   * Records a raw latency sample directly into the endpoint's reservoir.
   */
  public recordSample(endpointId: string, latencyMs: number): void {
    const reservoir = this.getOrCreateReservoir(endpointId);
    reservoir.addSample(latencyMs);
  }

  /**
   * Retrieves percentile statistics for an endpoint.
   */
  public getEndpointStats(endpointId: string): EndpointPercentileStats {
    const reservoir = this.getOrCreateReservoir(endpointId);
    return reservoir.getStats(this.defaultP95Ms);
  }

  /**
   * Executes a call with speculative hedged duplicate dispatch, deadline budget checks,
   * and cooperative winner-takes-all cancellation.
   */
  public async executeHedged<T>(options: HedgedExecutionOptions<T>): Promise<HedgedExecutionResult<T>> {
    const startTime = Date.now();
    const deadline = options.deadlineContext || (options.deadlineMs ? EosDeadlineContext.fromTimeout(options.deadlineMs, undefined, startTime) : null);

    // 1. Strict Deadline Budget Check (Early Shedding)
    if (deadline && deadline.isExpired(startTime)) {
      this.shedRequests++;
      this.totalRequests++;
      throw new Error(`DEADLINE_EXCEEDED: Remaining budget expired (${deadline.getRemainingMs(startTime)}ms) prior to dispatching endpoint ${options.endpointId}`);
    }

    this.totalRequests++;

    const reservoir = this.getOrCreateReservoir(options.endpointId);
    const stats = reservoir.getStats(this.defaultP95Ms);
    const delayMs = options.hedgingDelayMs ?? stats.p95Ms;

    // 2. Anti-Storm Hedging Token Bucket Check
    const allowedHedges = this.totalRequests < 20
      ? 1
      : Math.floor((this.totalRequests * this.maxHedgeRatePercent) / 100);
    const canHedge = this.hedgedRequests < allowedHedges;

    const primaryAbort = new AbortController();
    const hedgedAbort = new AbortController();

    let hedgeDispatched = false;
    let hedgeTimer: NodeJS.Timeout | null = null;

    try {
      const primaryPromise = options.primaryFn(primaryAbort.signal).then(res => ({
        result: res,
        executedBy: "PRIMARY" as const
      }));

      let hedgedPromise: Promise<{ result: T; executedBy: "HEDGED" }> | null = null;

      if (canHedge && delayMs > 0) {
        hedgedPromise = new Promise<{ result: T; executedBy: "HEDGED" }>((resolve, reject) => {
          hedgeTimer = setTimeout(() => {
            hedgeDispatched = true;
            this.hedgedRequests++;
            options.hedgedFn(hedgedAbort.signal)
              .then(res => resolve({ result: res, executedBy: "HEDGED" }))
              .catch(err => reject(err));
          }, delayMs);
        });
      }

      const winner = hedgedPromise
        ? await Promise.race([primaryPromise, hedgedPromise])
        : await primaryPromise;

      if (hedgeTimer) {
        clearTimeout(hedgeTimer);
      }

      // Cooperative cancellation of lagging operation
      if (winner.executedBy === "PRIMARY") {
        hedgedAbort.abort();
      } else {
        primaryAbort.abort();
      }

      const latencyMs = Date.now() - startTime;
      reservoir.addSample(latencyMs);

      const payloadToSign = {
        endpointId: options.endpointId,
        executedBy: winner.executedBy,
        latencyMs,
        hedgeDispatched,
        totalRequests: this.totalRequests,
        hedgedRequests: this.hedgedRequests
      };

      const sha256Receipt = crypto
        .createHash("sha256")
        .update(JSON.stringify(payloadToSign))
        .digest("hex");

      return {
        result: winner.result,
        executedBy: winner.executedBy,
        latencyMs,
        hedgeDispatched,
        sha256Receipt
      };
    } catch (err) {
      if (hedgeTimer) {
        clearTimeout(hedgeTimer);
      }
      primaryAbort.abort();
      hedgedAbort.abort();
      throw err;
    }
  }

  /**
   * Synchronous simulated execution of hedged requests for synthetic probes,
   * testing, and synchronous MCP dispatchers.
   */
  public executeHedgedSync(options: {
    readonly endpointId: string;
    readonly deadlineMs?: number;
    readonly hedgingDelayMs?: number;
    readonly simulatedPrimaryDelayMs?: number;
    readonly simulatedHedgedDelayMs?: number;
  }): HedgedExecutionResult<{ status: number; replica: string }> {
    const startTime = Date.now();

    // 1. Strict Deadline Budget Check (Early Shedding)
    if (options.deadlineMs !== undefined && options.deadlineMs <= 0) {
      this.shedRequests++;
      this.totalRequests++;
      throw new Error(`DEADLINE_EXCEEDED: Remaining budget expired (${options.deadlineMs}ms) prior to dispatching endpoint ${options.endpointId}`);
    }

    this.totalRequests++;

    const reservoir = this.getOrCreateReservoir(options.endpointId);
    const stats = reservoir.getStats(this.defaultP95Ms);
    const delayMs = options.hedgingDelayMs ?? stats.p95Ms;

    // 2. Anti-Storm Hedging Token Bucket Check
    const allowedHedges = this.totalRequests < 20
      ? 1
      : Math.floor((this.totalRequests * this.maxHedgeRatePercent) / 100);
    const canHedge = this.hedgedRequests < allowedHedges;

    const primaryLatency = Math.max(0, options.simulatedPrimaryDelayMs ?? 20);
    const hedgedLatency = Math.max(0, options.simulatedHedgedDelayMs ?? 15);

    let executedBy: "PRIMARY" | "HEDGED" = "PRIMARY";
    let hedgeDispatched = false;
    let latencyMs = primaryLatency;

    if (canHedge && primaryLatency > delayMs) {
      hedgeDispatched = true;
      this.hedgedRequests++;
      const hedgedTotalTime = delayMs + hedgedLatency;
      if (hedgedTotalTime < primaryLatency) {
        executedBy = "HEDGED";
        latencyMs = hedgedTotalTime;
      } else {
        executedBy = "PRIMARY";
        latencyMs = primaryLatency;
      }
    }

    reservoir.addSample(latencyMs);

    const payloadToSign = {
      endpointId: options.endpointId,
      executedBy,
      latencyMs,
      hedgeDispatched,
      totalRequests: this.totalRequests,
      hedgedRequests: this.hedgedRequests
    };

    const sha256Receipt = crypto
      .createHash("sha256")
      .update(JSON.stringify(payloadToSign))
      .digest("hex");

    return {
      result: { status: 200, replica: executedBy },
      executedBy,
      latencyMs,
      hedgeDispatched,
      sha256Receipt
    };
  }

  /**
   * Retrieves system-wide mesh telemetry, hedging ratios, and cryptographic receipt.
   */
  public getMetrics(): MeshMetricsSnapshot {
    const endpointsRecord: Record<string, EndpointPercentileStats> = {};
    for (const [id, reservoir] of this.endpoints) {
      endpointsRecord[id] = reservoir.getStats(this.defaultP95Ms);
    }

    const hedgedRatePct = this.totalRequests > 0
      ? Number(((this.hedgedRequests / this.totalRequests) * 100).toFixed(2))
      : 0;

    const payload = {
      totalRequests: this.totalRequests,
      hedgedRequests: this.hedgedRequests,
      hedgedRatePct,
      shedRequests: this.shedRequests,
      endpointCount: this.endpoints.size
    };

    const sha256Receipt = crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    return {
      totalRequests: this.totalRequests,
      hedgedRequests: this.hedgedRequests,
      hedgedRatePct,
      shedRequests: this.shedRequests,
      endpoints: endpointsRecord,
      sha256Receipt
    };
  }

  /**
   * Resets all internal buffers and counters.
   */
  public reset(): void {
    this.endpoints.clear();
    this.totalRequests = 0;
    this.hedgedRequests = 0;
    this.shedRequests = 0;
  }

  private getOrCreateReservoir(endpointId: string): LatencyReservoir {
    let res = this.endpoints.get(endpointId);
    if (!res) {
      res = new LatencyReservoir(200);
      this.endpoints.set(endpointId, res);
    }
    return res;
  }
}
