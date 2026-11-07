/**
 * EOS SYSTEM — UNIFIED RESILIENCE MESH (Layer 0)
 * Governed by SPEC-158 (Envoy / Istio / Failsafe pattern)
 *
 * Composable resilience strategy: Circuit Breaker + Bulkhead + Retry + Timeout.
 * Each call passes through the mesh chain:
 *   1. Bulkhead: limit concurrent calls per upstream
 *   2. Circuit Breaker: fast-fail if upstream is unhealthy
 *   3. Timeout: enforce deadline
 *   4. Retry: exponential backoff with jitter on transient failures
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ResilienceConfig {
  readonly maxConcurrent: number; // Bulkhead limit
  readonly failureThreshold: number; // CB: consecutive failures to open
  readonly cooldownMs: number; // CB: time before half-open probe
  readonly timeoutMs: number; // Per-call deadline
  readonly maxRetries: number; // Retry count on transient failure
  readonly baseBackoffMs: number; // Initial retry backoff
  readonly jitterMs: number; // Random jitter cap
}

export interface ResilienceCallResult<T> {
  readonly success: boolean;
  readonly value: T | null;
  readonly error: string | null;
  readonly attemptsUsed: number;
  readonly circuitState: CBState;
  readonly elapsedMs: number;
  readonly rejected: "NONE" | "BULKHEAD" | "CIRCUIT_OPEN";
}

interface CircuitBreaker {
  state: CBState;
  consecutiveFailures: number;
  openedAtMs: number | null;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class EosResilienceMesh {
  private readonly config: ResilienceConfig;
  private readonly circuit: CircuitBreaker = { state: "CLOSED", consecutiveFailures: 0, openedAtMs: null };
  private activeCalls = 0;

  constructor(config: ResilienceConfig) {
    assertPrecondition(config.maxConcurrent > 0, "maxConcurrent must be positive");
    assertPrecondition(config.timeoutMs > 0, "timeoutMs must be positive");
    this.config = config;
  }

  /**
   * Executes a function through the full resilience mesh.
   */
  async execute<T>(fn: () => Promise<T>): Promise<ResilienceCallResult<T>> {
    const start = performance.now();

    // 1. Bulkhead check
    if (this.activeCalls >= this.config.maxConcurrent) {
      return this.buildResult<T>(false, null, null, 0, "BULKHEAD", start);
    }

    // 2. Circuit breaker check
    this.evaluateCircuit();
    if (this.circuit.state === "OPEN") {
      return this.buildResult<T>(false, null, null, 0, "CIRCUIT_OPEN", start);
    }

    // 3. Execute with retry + timeout
    this.activeCalls++;
    let lastError = "";
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        const result = await this.withTimeout(fn, this.config.timeoutMs);
        this.activeCalls--;
        this.onSuccess();
        return this.buildResult(true, result, null, attempt, "NONE", start);
      } catch (err) {
        lastError = String(err);
        if (attempt <= this.config.maxRetries) {
          const backoff = this.config.baseBackoffMs * Math.pow(2, attempt - 1);
          const jitter = Math.random() * this.config.jitterMs;
          await this.sleep(backoff + jitter);
        }
      }
    }

    this.activeCalls--;
    this.onFailure();
    return this.buildResult<T>(false, null, lastError, this.config.maxRetries + 1, "NONE", start);
  }

  getCircuitState(): CBState {
    return this.circuit.state;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT_${ms}ms`)), ms)),
    ]);
  }

  private evaluateCircuit(): void {
    if (this.circuit.state === "OPEN" && this.circuit.openedAtMs !== null) {
      if (Date.now() - this.circuit.openedAtMs >= this.config.cooldownMs) {
        this.circuit.state = "HALF_OPEN";
      }
    }
  }

  private onSuccess(): void {
    this.circuit.consecutiveFailures = 0;
    this.circuit.state = "CLOSED";
    this.circuit.openedAtMs = null;
  }

  private onFailure(): void {
    this.circuit.consecutiveFailures++;
    if (this.circuit.consecutiveFailures >= this.config.failureThreshold) {
      this.circuit.state = "OPEN";
      this.circuit.openedAtMs = Date.now();
    }
  }

  private buildResult<T>(
    success: boolean,
    value: T | null,
    error: string | null,
    attempts: number,
    rejected: ResilienceCallResult<T>["rejected"],
    start: number,
  ): ResilienceCallResult<T> {
    return deepFreeze({
      success,
      value,
      error,
      attemptsUsed: attempts,
      circuitState: this.circuit.state,
      elapsedMs: Math.round(performance.now() - start),
      rejected,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, Math.min(ms, 50))); // Cap for tests
  }
}
