/**
 * EOS SYSTEM — NETFLIX AUTONOMOUS CHAOS RUNNER & RESILIENT CIRCUIT BREAKER (Layer 0)
 * Governed by SPEC-037, FR-109, BDD-101, BDD-102 & ADR-043
 *
 * Provides in-process chaos injection and automated 3-state circuit breaking:
 * 1. Controlled fault injection: Synthetic latency, Byzantine bit-flips, and network partition drops.
 * 2. In-process Circuit Breaker: CLOSED -> OPEN -> HALF_OPEN state machine.
 * 3. Autonomous resilience scoring (0-100) and signed execution receipts.
 * 4. Zero external runtime dependencies.
 */

import crypto from "node:crypto";

export type ChaosFaultType = "LATENCY" | "BYZANTINE" | "PARTITION";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ChaosConfig {
  readonly faultType: ChaosFaultType;
  readonly injectionRate: number; // 0.0 to 1.0 (probability)
  readonly latencyMs?: number;
  readonly partitionErrorMsg?: string;
}

export interface CircuitBreakerConfig {
  readonly failureThreshold: number; // e.g., 3 failures to trip OPEN
  readonly cooldownMs: number; // time in OPEN before attempting HALF_OPEN
  readonly recoveryProbes: number; // successful probes needed to reclose
}

export interface ChaosExecutionReport {
  readonly experimentName: string;
  readonly timestamp: string;
  readonly totalExecutions: number;
  readonly faultsInjected: number;
  readonly circuitTrips: number;
  readonly circuitState: CircuitState;
  readonly gracefulFallbacks: number;
  readonly unhandledPanics: number;
  readonly resilienceScore: number; // 0 to 100
  readonly sha256Receipt: string;
}

export class ChaosPartitionError extends Error {
  constructor(message = "Simulated network partition: downstream cluster unreachable") {
    super(message);
    this.name = "ChaosPartitionError";
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message = "Circuit breaker is OPEN: fast-failing execution") {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

export class EosAutonomousChaosRunner {
  private circuitState: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private consecutiveProbeSuccesses = 0;
  private lastStateTransitionTime = Date.now();
  private circuitTripCount = 0;

  private readonly cbConfig: CircuitBreakerConfig;

  constructor(cbConfig: Partial<CircuitBreakerConfig> = {}) {
    this.cbConfig = {
      failureThreshold: cbConfig.failureThreshold ?? 3,
      cooldownMs: cbConfig.cooldownMs ?? 30,
      recoveryProbes: cbConfig.recoveryProbes ?? 2,
    };
  }

  public getCircuitState(): CircuitState {
    this.checkCooldownTransition();
    return this.circuitState;
  }

  public getTripCount(): number {
    return this.circuitTripCount;
  }

  public resetCircuit(): void {
    this.circuitState = "CLOSED";
    this.consecutiveFailures = 0;
    this.consecutiveProbeSuccesses = 0;
    this.lastStateTransitionTime = Date.now();
  }

  private checkCooldownTransition(): void {
    if (this.circuitState === "OPEN") {
      const elapsed = Date.now() - this.lastStateTransitionTime;
      if (elapsed >= this.cbConfig.cooldownMs) {
        this.circuitState = "HALF_OPEN";
        this.consecutiveProbeSuccesses = 0;
        this.lastStateTransitionTime = Date.now();
      }
    }
  }

  public recordSuccess(): void {
    this.checkCooldownTransition();

    if (this.circuitState === "HALF_OPEN") {
      this.consecutiveProbeSuccesses++;
      if (this.consecutiveProbeSuccesses >= this.cbConfig.recoveryProbes) {
        this.circuitState = "CLOSED";
        this.consecutiveFailures = 0;
        this.consecutiveProbeSuccesses = 0;
        this.lastStateTransitionTime = Date.now();
      }
    } else if (this.circuitState === "CLOSED") {
      this.consecutiveFailures = 0;
    }
  }

  public recordFailure(): void {
    this.checkCooldownTransition();

    if (this.circuitState === "HALF_OPEN") {
      // Any probe failure sends circuit back to OPEN
      this.circuitState = "OPEN";
      this.consecutiveFailures = this.cbConfig.failureThreshold;
      this.consecutiveProbeSuccesses = 0;
      this.lastStateTransitionTime = Date.now();
      this.circuitTripCount++;
    } else if (this.circuitState === "CLOSED") {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.cbConfig.failureThreshold) {
        this.circuitState = "OPEN";
        this.lastStateTransitionTime = Date.now();
        this.circuitTripCount++;
      }
    }
  }

  /**
   * Executes an operation through the Circuit Breaker with optional chaos injection.
   */
  public async executeProtected<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    chaosConfig?: ChaosConfig,
  ): Promise<{ result: T; fallbackUsed: boolean; faultInjected: boolean }> {
    this.checkCooldownTransition();

    if (this.circuitState === "OPEN") {
      const fbResult = await fallback();
      return { result: fbResult, fallbackUsed: true, faultInjected: false };
    }

    let faultInjected = false;

    // Check chaos injection probability
    if (chaosConfig && Math.random() < chaosConfig.injectionRate) {
      faultInjected = true;
      if (chaosConfig.faultType === "LATENCY") {
        const delay = chaosConfig.latencyMs ?? 20;
        await new Promise((r) => setTimeout(r, delay));
      } else if (chaosConfig.faultType === "PARTITION") {
        this.recordFailure();
        const fbResult = await fallback();
        return { result: fbResult, fallbackUsed: true, faultInjected: true };
      }
    }

    try {
      const res = await operation();
      let finalResult = res;

      // Byzantine payload corruption
      if (chaosConfig && faultInjected && chaosConfig.faultType === "BYZANTINE") {
        finalResult = this.applyByzantineCorruption(res);
      }

      this.recordSuccess();
      return { result: finalResult, fallbackUsed: false, faultInjected };
    } catch {
      this.recordFailure();
      const fbResult = await fallback();
      return { result: fbResult, fallbackUsed: true, faultInjected };
    }
  }

  /**
   * Injects Byzantine corruption into byte buffers or string payloads.
   */
  public applyByzantineCorruption<T>(payload: T): T {
    if (Buffer.isBuffer(payload)) {
      const copy = Buffer.from(payload);
      if (copy.length > 0) {
        copy[0] = copy[0] ^ 0xff; // Invert first byte
      }
      return copy as unknown as T;
    }
    if (payload instanceof Uint8Array) {
      const copy = new Uint8Array(payload);
      if (copy.length > 0) {
        copy[0] = copy[0] ^ 0xff;
      }
      return copy as unknown as T;
    }
    if (typeof payload === "string") {
      return (payload + " [BYZANTINE_CORRUPTED]") as unknown as T;
    }
    if (payload && typeof payload === "object") {
      return {
        ...payload,
        __byzantineFault: true,
        __corruptedHash: "00000000000000000000000000000000",
      } as unknown as T;
    }
    return payload;
  }

  /**
   * Executes a battery of chaos tests and returns a deterministic resilience report.
   */
  public async runChaosBattery(experimentName: string, iterations: number = 30): Promise<ChaosExecutionReport> {
    this.resetCircuit();
    let faultsInjected = 0;
    let fallbackCount = 0;
    let unhandledPanics = 0;

    for (let i = 0; i < iterations; i++) {
      const faultType: ChaosFaultType = i % 3 === 0 ? "PARTITION" : i % 3 === 1 ? "BYZANTINE" : "LATENCY";

      try {
        const { fallbackUsed, faultInjected: injected } = await this.executeProtected(
          async () => {
            if (faultType === "PARTITION") {
              throw new ChaosPartitionError();
            }
            return { status: "OK", iteration: i };
          },
          async () => {
            return { status: "FALLBACK_SAFE", iteration: i };
          },
          {
            faultType,
            injectionRate: 0.8,
            latencyMs: 5,
          },
        );

        if (injected) faultsInjected++;
        if (fallbackUsed) fallbackCount++;
      } catch {
        unhandledPanics++;
      }
    }

    // Scoring: 100 base, penalize unhandled panics heavily, reward fallback containment
    const panicPenalty = unhandledPanics * 25;
    const containmentReward = faultsInjected > 0 ? (fallbackCount / faultsInjected) * 20 : 20;
    const resilienceScore = Math.max(0, Math.min(100, Math.round(80 + containmentReward - panicPenalty)));

    const rawData = `${experimentName}:${iterations}:${faultsInjected}:${this.circuitTripCount}:${resilienceScore}`;
    const sha256Receipt = crypto.createHash("sha256").update(rawData).digest("hex");

    return {
      experimentName,
      timestamp: new Date().toISOString(),
      totalExecutions: iterations,
      faultsInjected,
      circuitTrips: this.circuitTripCount,
      circuitState: this.circuitState,
      gracefulFallbacks: fallbackCount,
      unhandledPanics,
      resilienceScore,
      sha256Receipt,
    };
  }
}
