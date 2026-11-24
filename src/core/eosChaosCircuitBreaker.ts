/**
 * EOS Sovereign Architecture - Layer 0
 * Chaos Engineering & Circuit Breaker Fault Injection Gateway
 * SPEC-279 / CHANGE-141
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";

export type ChaosCircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ChaosCircuitBreakerConfig {
  slidingWindowSize?: number;
  minimumNumberOfCalls?: number;
  failureRateThreshold?: number; // percentage 0 - 100
  slowCallRateThreshold?: number; // percentage 0 - 100
  slowCallDurationThresholdMs?: number;
  waitDurationInOpenStateMs?: number;
  permittedNumberOfCallsInHalfOpenState?: number;
  evidencePath?: string;
}

export interface ChaosFaultPolicy {
  targetServicePattern?: string;
  latencyDelayMs?: number;
  failureProbability?: number; // 0.0 - 1.0
  simulatedErrorCode?: string;
  enabled?: boolean;
}

export interface ChaosCircuitBreakerMetrics {
  serviceName: string;
  state: ChaosCircuitBreakerState;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  slowCalls: number;
  rejectedCalls: number;
  failureRate: number;
  slowCallRate: number;
  lastStateTransitionTime: string;
}

export interface ChaosReceipt {
  schemaVersion: "1.0.0";
  timestamp: string;
  serviceName: string;
  metrics: ChaosCircuitBreakerMetrics;
  evidenceSha256: string;
}

interface WindowEntry {
  type: "SUCCESS" | "FAILURE" | "SLOW";
  durationMs: number;
}

export class EosChaosCircuitBreaker {
  public readonly serviceName: string;
  private readonly config: Required<ChaosCircuitBreakerConfig>;
  private chaosPolicy: ChaosFaultPolicy;

  private state: ChaosCircuitBreakerState = "CLOSED";
  private lastStateTransitionTime: number = Date.now();

  private window: WindowEntry[] = [];
  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private slowCalls = 0;
  private rejectedCalls = 0;

  private halfOpenCalls = 0;
  private halfOpenSuccesses = 0;

  constructor(serviceName: string, config: ChaosCircuitBreakerConfig = {}, chaosPolicy: ChaosFaultPolicy = {}) {
    this.serviceName = serviceName;
    this.config = {
      slidingWindowSize: config.slidingWindowSize ?? 20,
      minimumNumberOfCalls: config.minimumNumberOfCalls ?? 5,
      failureRateThreshold: config.failureRateThreshold ?? 50.0,
      slowCallRateThreshold: config.slowCallRateThreshold ?? 50.0,
      slowCallDurationThresholdMs: config.slowCallDurationThresholdMs ?? 500,
      waitDurationInOpenStateMs: config.waitDurationInOpenStateMs ?? 5000,
      permittedNumberOfCallsInHalfOpenState: config.permittedNumberOfCallsInHalfOpenState ?? 5,
      evidencePath: config.evidencePath ?? resolveEvidencePath("CHAOS_RECEIPT.json"),
    };
    this.chaosPolicy = {
      enabled: false,
      failureProbability: 0,
      latencyDelayMs: 0,
      ...chaosPolicy,
    };
  }

  public getState(): ChaosCircuitBreakerState {
    this.checkStateTransition();
    return this.state;
  }

  public setChaosPolicy(policy: ChaosFaultPolicy): void {
    this.chaosPolicy = { ...this.chaosPolicy, ...policy };
  }

  public async execute<T>(
    fn: () => Promise<T> | T,
    fallback?: (err: Error) => Promise<T> | T,
    targetService = this.serviceName,
  ): Promise<T> {
    this.checkStateTransition();

    if (this.state === "OPEN") {
      this.rejectedCalls++;
      const openErr = new Error(`CIRCUIT_BREAKER_OPEN: Service ${this.serviceName} is unavailable`);
      if (fallback) return await fallback(openErr);
      throw openErr;
    }

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenCalls >= this.config.permittedNumberOfCallsInHalfOpenState) {
        this.rejectedCalls++;
        const halfOpenErr = new Error(`CIRCUIT_BREAKER_HALF_OPEN_CAPACITY: Probe limit reached`);
        if (fallback) return await fallback(halfOpenErr);
        throw halfOpenErr;
      }
      this.halfOpenCalls++;
    }

    this.totalCalls++;
    const startTime = Date.now();

    try {
      // Evaluate Chaos Fault Injection
      if (this.chaosPolicy.enabled) {
        const pattern = this.chaosPolicy.targetServicePattern;
        const matches = !pattern || new RegExp(pattern).test(targetService);
        if (matches) {
          if (this.chaosPolicy.latencyDelayMs && this.chaosPolicy.latencyDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.chaosPolicy.latencyDelayMs));
          }
          if (
            typeof this.chaosPolicy.failureProbability === "number" &&
            this.chaosPolicy.failureProbability > 0 &&
            Math.random() < this.chaosPolicy.failureProbability
          ) {
            throw new Error(`CHAOS_INJECTED_FAULT: ${this.chaosPolicy.simulatedErrorCode || "SIMULATED_FAILURE"}`);
          }
        }
      }

      const result = await fn();
      const durationMs = Date.now() - startTime;
      this.recordSuccess(durationMs);
      return result;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.recordFailure();
      if (fallback) {
        return await fallback(errorObj);
      }
      throw errorObj;
    }
  }

  private checkStateTransition(): void {
    const now = Date.now();
    if (this.state === "OPEN") {
      if (now - this.lastStateTransitionTime >= this.config.waitDurationInOpenStateMs) {
        this.transitionTo("HALF_OPEN");
      }
    }
  }

  private transitionTo(newState: ChaosCircuitBreakerState): void {
    this.state = newState;
    this.lastStateTransitionTime = Date.now();
    if (newState === "HALF_OPEN") {
      this.halfOpenCalls = 0;
      this.halfOpenSuccesses = 0;
    } else if (newState === "CLOSED") {
      this.window = [];
    }
  }

  private recordSuccess(durationMs: number): void {
    this.successfulCalls++;
    const isSlow = durationMs >= this.config.slowCallDurationThresholdMs;
    if (isSlow) this.slowCalls++;

    const entryType: WindowEntry["type"] = isSlow ? "SLOW" : "SUCCESS";
    this.pushWindow({ type: entryType, durationMs });

    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.permittedNumberOfCallsInHalfOpenState) {
        this.transitionTo("CLOSED");
      }
    } else if (this.state === "CLOSED") {
      this.evaluateRates();
    }
  }

  private recordFailure(): void {
    this.failedCalls++;
    this.pushWindow({ type: "FAILURE", durationMs: 0 });

    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED") {
      this.evaluateRates();
    }
  }

  private pushWindow(entry: WindowEntry): void {
    this.window.push(entry);
    if (this.window.length > this.config.slidingWindowSize) {
      this.window.shift();
    }
  }

  private evaluateRates(): void {
    if (this.window.length < this.config.minimumNumberOfCalls) return;

    const failures = this.window.filter((w) => w.type === "FAILURE").length;
    const slowCalls = this.window.filter((w) => w.type === "SLOW").length;
    const total = this.window.length;

    const failureRate = (failures / total) * 100;
    const slowCallRate = (slowCalls / total) * 100;

    if (failureRate >= this.config.failureRateThreshold || slowCallRate >= this.config.slowCallRateThreshold) {
      this.transitionTo("OPEN");
    }
  }

  public getMetrics(): ChaosCircuitBreakerMetrics {
    this.checkStateTransition();
    const failures = this.window.filter((w) => w.type === "FAILURE").length;
    const slow = this.window.filter((w) => w.type === "SLOW").length;
    const count = this.window.length;

    return {
      serviceName: this.serviceName,
      state: this.state,
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      slowCalls: this.slowCalls,
      rejectedCalls: this.rejectedCalls,
      failureRate: count > 0 ? Number(((failures / count) * 100).toFixed(2)) : 0,
      slowCallRate: count > 0 ? Number(((slow / count) * 100).toFixed(2)) : 0,
      lastStateTransitionTime: new Date(this.lastStateTransitionTime).toISOString(),
    };
  }

  public reset(): void {
    this.window = [];
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.slowCalls = 0;
    this.rejectedCalls = 0;
    this.transitionTo("CLOSED");
  }

  public forceOpen(): void {
    this.transitionTo("OPEN");
  }

  public forceClosed(): void {
    this.transitionTo("CLOSED");
  }

  public generateReceipt(outputPath = this.config.evidencePath): {
    receiptPath: string;
    sha256: string;
    metrics: ChaosCircuitBreakerMetrics;
  } {
    const metrics = this.getMetrics();
    const payload = {
      schemaVersion: "1.0.0",
      timestamp: new Date().toISOString(),
      serviceName: this.serviceName,
      metrics,
    };
    const content = JSON.stringify(payload, null, 2);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const sealed = { ...payload, evidenceSha256: sha256 };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(sealed, null, 2), "utf8");

    return { receiptPath: outputPath, sha256, metrics };
  }
}
