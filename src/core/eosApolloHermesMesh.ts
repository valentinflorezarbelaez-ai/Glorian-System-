/**
 * EOS Sovereign Apollo / Hermes RPC & Event Mesh (SPEC-015, BDD-046)
 *
 * Modeled after Spotify's Apollo microservice framework and Hermes messaging mesh:
 * - 3-State Circuit Breaker (CLOSED, OPEN, HALF_OPEN) with sliding error window.
 * - W3C Distributed Tracing (traceparent header propagation).
 * - High-concurrency Token Bucket Rate Limiter.
 * - 32-bit FNV-1a Topic Partitioning for distributed event routing.
 * - Layer-0 pure TypeScript implementation (dependencies: {}).
 */

import * as crypto from "node:crypto";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThresholdPercentage: number; // e.g. 50
  slidingWindowSize: number; // e.g. 10 requests
  resetTimeoutMs: number; // e.g. 500ms
  halfOpenTrialSuccesses: number; // e.g. 3
}

export interface W3CTraceContext {
  version: string;
  traceId: string;
  parentId: string;
  spanId: string;
  traceFlags: string;
  headerString: string;
}

export interface RpcCallTelemetry<R> {
  success: boolean;
  serviceName: string;
  endpoint: string;
  durationUs: number;
  circuitState: CircuitBreakerState;
  traceContext: W3CTraceContext;
  data?: R;
  error?: string;
  partitionId: number;
}

export interface MeshEvent<T = unknown> {
  eventId: string;
  topic: string;
  partitionId: number;
  traceparent: string;
  timestampMs: number;
  payload: T;
}

export class EosCircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private window: boolean[] = [];
  private lastStateChangeMs = Date.now();
  private halfOpenSuccesses = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThresholdPercentage: config.failureThresholdPercentage ?? 50,
      slidingWindowSize: config.slidingWindowSize ?? 10,
      resetTimeoutMs: config.resetTimeoutMs ?? 500,
      halfOpenTrialSuccesses: config.halfOpenTrialSuccesses ?? 3,
    };
  }

  public getState(): CircuitBreakerState {
    const now = Date.now();
    if (this.state === "OPEN" && now - this.lastStateChangeMs >= this.config.resetTimeoutMs) {
      this.state = "HALF_OPEN";
      this.halfOpenSuccesses = 0;
      this.lastStateChangeMs = now;
    }
    return this.state;
  }

  public canExecute(): boolean {
    const currentState = this.getState();
    return currentState === "CLOSED" || currentState === "HALF_OPEN";
  }

  public recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenTrialSuccesses) {
        this.state = "CLOSED";
        this.window = [];
        this.lastStateChangeMs = Date.now();
      }
    } else {
      this.recordOutcome(true);
    }
  }

  public recordFailure(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.lastStateChangeMs = Date.now();
    } else {
      this.recordOutcome(false);
    }
  }

  private recordOutcome(success: boolean): void {
    this.window.push(success);
    if (this.window.length > this.config.slidingWindowSize) {
      this.window.shift();
    }

    if (this.window.length >= this.config.slidingWindowSize) {
      const failures = this.window.filter((s) => !s).length;
      const failureRate = (failures / this.window.length) * 100;
      if (failureRate >= this.config.failureThresholdPercentage) {
        this.state = "OPEN";
        this.lastStateChangeMs = Date.now();
      }
    }
  }
}

export class EosTokenBucketRateLimiter {
  private capacity: number;
  private refillRatePerSec: number;
  private tokens: number;
  private lastRefillNs: bigint;

  constructor(capacity = 1000, refillRatePerSec = 1000) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.tokens = capacity;
    this.lastRefillNs = process.hrtime.bigint();
  }

  public tryAcquire(requested = 1): boolean {
    this.refill();
    if (this.tokens >= requested) {
      this.tokens -= requested;
      return true;
    }
    return false;
  }

  public getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = process.hrtime.bigint();
    const elapsedSec = Number(now - this.lastRefillNs) / 1_000_000_000;
    const addedTokens = elapsedSec * this.refillRatePerSec;
    if (addedTokens > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefillNs = now;
    }
  }
}

export class EosApolloHermesMesh {
  private circuitBreakers = new Map<string, EosCircuitBreaker>();
  private rateLimiter: EosTokenBucketRateLimiter;
  private eventSubscribers = new Map<string, Array<(event: MeshEvent) => void>>();
  private totalEventsPublished = 0;
  private totalRpcInvocations = 0;

  constructor(rateLimiterCapacity = 5000, refillRatePerSec = 5000) {
    this.rateLimiter = new EosTokenBucketRateLimiter(rateLimiterCapacity, refillRatePerSec);
  }

  /**
   * 1. 32-bit FNV-1a Hash for Deterministic Partitioning across N Shards.
   */
  public static fnv1a32(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      hash = hash >>> 0;
    }
    return hash;
  }

  /**
   * 2. Computes target partition index for a given key and shard count.
   */
  public computePartition(key: string, totalPartitions = 16): number {
    return EosApolloHermesMesh.fnv1a32(key) % totalPartitions;
  }

  /**
   * 3. Generates standard W3C Trace Context (traceparent: 00-{traceId}-{spanId}-01).
   */
  public generateTraceContext(parent?: W3CTraceContext | string): W3CTraceContext {
    let traceId: string;
    let parentId = "0000000000000000";

    if (typeof parent === "string") {
      const parsed = this.parseTraceparent(parent);
      if (parsed) {
        traceId = parsed.traceId;
        parentId = parsed.spanId;
      } else {
        traceId = crypto.randomBytes(16).toString("hex");
      }
    } else if (parent) {
      traceId = parent.traceId;
      parentId = parent.spanId;
    } else {
      traceId = crypto.randomBytes(16).toString("hex");
    }

    const spanId = crypto.randomBytes(8).toString("hex");
    const headerString = `00-${traceId}-${spanId}-01`;

    return {
      version: "00",
      traceId,
      parentId,
      spanId,
      traceFlags: "01",
      headerString,
    };
  }

  /**
   * 4. Parses W3C traceparent string into structured context.
   */
  public parseTraceparent(header: string): W3CTraceContext | null {
    const parts = header.trim().split("-");
    if (parts.length !== 4 || parts[0] !== "00") return null;
    return {
      version: parts[0],
      traceId: parts[1],
      parentId: "0000000000000000",
      spanId: parts[2],
      traceFlags: parts[3],
      headerString: header,
    };
  }

  /**
   * 5. Gets or creates a circuit breaker for a target service.
   */
  public getCircuitBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): EosCircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new EosCircuitBreaker(config));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * 6. Invokes an asynchronous Apollo RPC handler with full resilience:
   * Rate Limiting + Circuit Breaking + W3C Tracing + Microsecond Timing.
   */
  public async invokeRpc<T, R>(
    serviceName: string,
    endpoint: string,
    payload: T,
    handler: (data: T, trace: W3CTraceContext) => Promise<R> | R,
    parentTrace?: W3CTraceContext | string,
  ): Promise<RpcCallTelemetry<R>> {
    const start = process.hrtime.bigint();
    this.totalRpcInvocations++;
    const traceContext = this.generateTraceContext(parentTrace);
    const cb = this.getCircuitBreaker(serviceName);
    const partitionId = this.computePartition(`${serviceName}:${endpoint}`);

    // Check Token Bucket Rate Limit
    if (!this.rateLimiter.tryAcquire(1)) {
      const durationUs = Number(process.hrtime.bigint() - start) / 1000;
      return {
        success: false,
        serviceName,
        endpoint,
        durationUs,
        circuitState: cb.getState(),
        traceContext,
        error: "HTTP 429 Too Many Requests (Rate limit bucket exhausted)",
        partitionId,
      };
    }

    // Check Circuit Breaker
    if (!cb.canExecute()) {
      const durationUs = Number(process.hrtime.bigint() - start) / 1000;
      return {
        success: false,
        serviceName,
        endpoint,
        durationUs,
        circuitState: "OPEN",
        traceContext,
        error: `Circuit breaker for '${serviceName}' is OPEN`,
        partitionId,
      };
    }

    try {
      const result = await handler(payload, traceContext);
      cb.recordSuccess();
      const durationUs = Number(process.hrtime.bigint() - start) / 1000;
      return {
        success: true,
        serviceName,
        endpoint,
        durationUs,
        circuitState: cb.getState(),
        traceContext,
        data: result,
        partitionId,
      };
    } catch (err: unknown) {
      cb.recordFailure();
      const durationUs = Number(process.hrtime.bigint() - start) / 1000;
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        serviceName,
        endpoint,
        durationUs,
        circuitState: cb.getState(),
        traceContext,
        error: errorMessage,
        partitionId,
      };
    }
  }

  /**
   * 7. Publishes an event to Hermes messaging mesh with topic partitioning.
   */
  public publishEvent<T>(topic: string, partitionKey: string, payload: T, parentTrace?: string): MeshEvent<T> {
    this.totalEventsPublished++;
    const partitionId = this.computePartition(partitionKey);
    const traceContext = this.generateTraceContext(parentTrace);
    const event: MeshEvent<T> = {
      eventId: crypto.randomBytes(12).toString("hex"),
      topic,
      partitionId,
      traceparent: traceContext.headerString,
      timestampMs: Date.now(),
      payload,
    };

    const subscribers = this.eventSubscribers.get(topic) || [];
    for (const sub of subscribers) {
      try {
        sub(event as MeshEvent);
      } catch {
        // Drop subscriber errors gracefully without crashing the mesh
      }
    }

    return event;
  }

  /**
   * 8. Subscribes to Hermes topic events.
   */
  public subscribe(topic: string, subscriber: (event: MeshEvent) => void): () => void {
    if (!this.eventSubscribers.has(topic)) {
      this.eventSubscribers.set(topic, []);
    }
    const subs = this.eventSubscribers.get(topic)!;
    subs.push(subscriber);

    // Unsubscribe callback
    return () => {
      const idx = subs.indexOf(subscriber);
      if (idx !== -1) subs.splice(idx, 1);
    };
  }

  /**
   * 9. Generates telemetry report of mesh health.
   */
  public getMeshReport(): {
    totalRpcInvocations: number;
    totalEventsPublished: number;
    activeCircuitBreakers: Array<{ serviceName: string; state: CircuitBreakerState }>;
    rateLimiterAvailableTokens: number;
    activeSubscribers: number;
  } {
    const activeCircuitBreakers: Array<{ serviceName: string; state: CircuitBreakerState }> = [];
    for (const [serviceName, cb] of this.circuitBreakers.entries()) {
      activeCircuitBreakers.push({ serviceName, state: cb.getState() });
    }

    let activeSubscribers = 0;
    for (const subs of this.eventSubscribers.values()) {
      activeSubscribers += subs.length;
    }

    return {
      totalRpcInvocations: this.totalRpcInvocations,
      totalEventsPublished: this.totalEventsPublished,
      activeCircuitBreakers,
      rateLimiterAvailableTokens: Math.round(this.rateLimiter.getAvailableTokens()),
      activeSubscribers,
    };
  }
}
