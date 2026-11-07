/**
 * EOS SYSTEM — NSA CONTINUOUS SIDE-CHANNEL & TIMING ANOMALY DETECTOR
 * Governed by ADR-040, SPEC-034, FR-097, BDD-089
 *
 * Implements:
 * 1. Real-time statistical timing variance inspection for side-channel attack detection.
 * 2. Consecutive authentication failure & privilege escalation tracking.
 * 3. Fail-Closed Emergency Lockdown: Instantly zeroizes registered memory and rejects operations.
 * 4. Cryptographic incident attestation using SHA-384.
 *
 * 100% Layer-0 Purity with zero runtime npm dependencies.
 */

import { EosNsaCryptoSuite } from "./eosNsaCryptoSuite.ts";

export type NsaSecurityState = "NOMINAL" | "SUSPICIOUS" | "EMERGENCY_LOCKDOWN";

export interface NsaIncidentReport {
  readonly incidentId: string;
  readonly previousState: NsaSecurityState;
  readonly currentState: NsaSecurityState;
  readonly triggerReason: string;
  readonly consecutiveFailures: number;
  readonly timingVarianceMs: number;
  readonly timestamp: string;
  readonly sha384Attestation: string;
}

export class EosNsaAnomalyDetector {
  private state: NsaSecurityState = "NOMINAL";
  private consecutiveFailures = 0;
  private readonly maxAllowedFailures: number;
  private readonly timingHistory: number[] = [];
  private readonly zeroizeCallbacks: (() => void)[] = [];
  private incidentReports: NsaIncidentReport[] = [];

  constructor(maxAllowedFailures = 3) {
    this.maxAllowedFailures = maxAllowedFailures;
  }

  /**
   * Registers a zeroization callback executed immediately upon emergency lockdown.
   */
  public registerZeroizeTarget(callback: () => void): void {
    this.zeroizeCallbacks.push(callback);
  }

  /**
   * Records a successful cryptographic operation and checks timing variance.
   */
  public recordSuccess(durationMs: number): void {
    if (this.state === "EMERGENCY_LOCKDOWN") return;

    this.consecutiveFailures = 0;
    this.timingHistory.push(durationMs);
    if (this.timingHistory.length > 50) {
      this.timingHistory.shift();
    }
  }

  /**
   * Records an authentication or integrity failure (e.g. invalid GCM tag, classification violation).
   * If threshold is reached, triggers immediate fail-closed lockdown.
   */
  public recordFailure(reason: string): NsaSecurityState {
    if (this.state === "EMERGENCY_LOCKDOWN") {
      return this.state;
    }

    this.consecutiveFailures++;

    if (this.consecutiveFailures >= this.maxAllowedFailures) {
      this.triggerEmergencyLockdown(reason);
    } else {
      this.state = "SUSPICIOUS";
    }

    return this.state;
  }

  /**
   * Evaluates if timing characteristics exhibit suspicious side-channel probing.
   */
  public evaluateTimingVariance(anomalousVarianceThresholdMs = 15.0): boolean {
    if (this.timingHistory.length < 5) return false;

    const mean = this.timingHistory.reduce((a, b) => a + b, 0) / this.timingHistory.length;
    const variance = this.timingHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.timingHistory.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > anomalousVarianceThresholdMs) {
      this.triggerEmergencyLockdown(
        `High timing variance detected (${stdDev.toFixed(2)}ms > threshold ${anomalousVarianceThresholdMs}ms)`,
      );
      return true;
    }

    return false;
  }

  /**
   * Triggers an emergency lockdown, executing all registered memory zeroization routines.
   */
  public triggerEmergencyLockdown(reason: string): NsaIncidentReport {
    const prevState = this.state;
    this.state = "EMERGENCY_LOCKDOWN";

    // Execute zeroization on all registered targets
    for (const callback of this.zeroizeCallbacks) {
      try {
        callback();
      } catch {
        // Fail-safe: continue zeroizing other targets
      }
    }

    const timestamp = new Date().toISOString();
    const rawAttestation = `LOCKDOWN|${prevState}|${reason}|${this.consecutiveFailures}|${timestamp}`;
    const sha384Attestation = EosNsaCryptoSuite.computeSha384(rawAttestation);

    const report: NsaIncidentReport = {
      incidentId: `INC-${Date.now()}`,
      previousState: prevState,
      currentState: this.state,
      triggerReason: reason,
      consecutiveFailures: this.consecutiveFailures,
      timingVarianceMs: this.timingHistory.length > 0 ? this.timingHistory[this.timingHistory.length - 1] : 0,
      timestamp,
      sha384Attestation,
    };

    this.incidentReports.push(report);
    return report;
  }

  /**
   * Checks if the system is currently in emergency lockdown.
   */
  public isLockedDown(): boolean {
    return this.state === "EMERGENCY_LOCKDOWN";
  }

  public getState(): NsaSecurityState {
    return this.state;
  }

  public getIncidentReports(): readonly NsaIncidentReport[] {
    return Object.freeze([...this.incidentReports]);
  }

  /**
   * Resets the lockdown state only when presented with an authorized cryptographic token.
   */
  public authorizedReset(token: string, expectedToken: string): boolean {
    if (!EosNsaCryptoSuite.constantTimeCompare(token, expectedToken)) {
      this.recordFailure("Unauthorized reset attempt with invalid cryptographic token");
      return false;
    }

    this.state = "NOMINAL";
    this.consecutiveFailures = 0;
    this.timingHistory.length = 0;
    return true;
  }
}
