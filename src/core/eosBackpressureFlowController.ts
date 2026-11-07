/**
 * EOS SYSTEM — BACKPRESSURE FLOW CONTROL (Layer 0)
 * Governed by SPEC-157 (Reactive Streams / TCP congestion window)
 *
 * Implements demand-based flow control:
 * - Consumer signals demand (how many items it can process)
 * - Producer respects outstanding demand, cannot exceed
 * - Congestion window: tracks inflight, halves on failure (TCP-like)
 * - High/low watermarks for backpressure signal
 *
 * Zero external dependencies.
 */

import { deepFreeze, assertPrecondition } from "./eosKernelPrimitives.ts";

export interface BackpressureConfig {
  readonly initialWindow: number; // Starting congestion window
  readonly maxWindow: number;
  readonly highWatermark: number; // % of window to signal pressure
  readonly lowWatermark: number; // % to resume
  readonly congestionMultiplier: number; // e.g., 0.5 on loss
}

export type PressureState = "OPEN" | "HIGH_WATER" | "CLOSED";

export interface FlowSnapshot {
  readonly windowSize: number;
  readonly inflight: number;
  readonly remainingDemand: number;
  readonly pressure: PressureState;
  readonly utilizationPercent: number;
}

export class EosBackpressureFlowController {
  private window: number;
  private inflight = 0;
  private demand = 0;
  private state: PressureState = "OPEN";
  private totalAccepted = 0;
  private totalRejected = 0;
  private readonly config: BackpressureConfig;

  constructor(config: BackpressureConfig) {
    this.config = config;
    this.window = config.initialWindow;
  }

  /**
   * Consumer signals additional demand (can process N more items).
   */
  signalDemand(count: number): void {
    assertPrecondition(count >= 0, "demand must be non-negative");
    this.demand += count;
  }

  /**
   * Producer attempts to emit an item. Returns whether it was accepted.
   */
  tryEmit(): boolean {
    // Check demand + window
    if (this.demand <= 0 || this.inflight >= this.window) {
      this.totalRejected++;
      this.updatePressure();
      return false;
    }
    this.demand--;
    this.inflight++;
    this.totalAccepted++;
    this.updatePressure();
    return true;
  }

  /**
   * Consumer acknowledges processing an item (reduces inflight).
   */
  acknowledge(): void {
    if (this.inflight > 0) this.inflight--;
    // TCP-like: additive increase on successful delivery
    this.window = Math.min(this.config.maxWindow, this.window + 1);
    this.updatePressure();
  }

  /**
   * Signals item loss/failure: multiplicative decrease on window.
   */
  signalLoss(): void {
    this.window = Math.max(1, Math.floor(this.window * this.config.congestionMultiplier));
    if (this.inflight > 0) this.inflight--;
    this.updatePressure();
  }

  /**
   * Returns current flow control snapshot.
   */
  getSnapshot(): FlowSnapshot {
    const utilization = this.window > 0 ? (this.inflight / this.window) * 100 : 0;
    return deepFreeze({
      windowSize: this.window,
      inflight: this.inflight,
      remainingDemand: this.demand,
      pressure: this.state,
      utilizationPercent: Math.round(utilization * 100) / 100,
    });
  }

  getStats(): { totalAccepted: number; totalRejected: number } {
    return { totalAccepted: this.totalAccepted, totalRejected: this.totalRejected };
  }

  private updatePressure(): void {
    const ratio = this.window > 0 ? this.inflight / this.window : 1;
    if (ratio >= this.config.highWatermark / 100) {
      this.state = "HIGH_WATER";
    } else if (ratio <= this.config.lowWatermark / 100) {
      this.state = "OPEN";
    } else {
      this.state = this.state === "HIGH_WATER" ? "HIGH_WATER" : "OPEN";
    }
  }
}
