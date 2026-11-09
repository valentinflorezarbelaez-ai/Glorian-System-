/**
 * EOS SYSTEM — HASHED TIMING WHEEL SCHEDULER (Layer 0)
 * Governed by SPEC-177 (Netty HashedWheelTimer / Kafka delay queue pattern)
 *
 * Implements:
 * - O(1) timer registration and cancellation via slot hashing
 * - Multi-round overflow for far-future deadlines
 * - One-shot and repeating timers
 * - Deterministic virtual clock (advance ticks explicitly; ideal for tests)
 * - Slot introspection and telemetry fingerprints
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface WheelConfig {
  readonly slots: number; // wheel circumference (power of 2 recommended)
  readonly tickDurationMs: number;
}

export interface TimerHandle {
  readonly id: number;
  readonly deadlineTick: number;
  readonly intervalTicks: number; // 0 = one-shot
}

interface TimerSlot {
  handle: TimerHandle;
  rounds: number;
  fire: () => void;
  cancelled: boolean;
}

export class EosHashedTimingWheel {
  private readonly slotsArr: TimerSlot[][];
  private readonly config: WheelConfig;
  private currentTick = 0;
  private seq = 0;
  private scheduled = 0;
  private fired = 0;
  private cancelledCount = 0;

  constructor(config: WheelConfig) {
    assertPrecondition(config.slots >= 2, "slots must be >= 2");
    assertPrecondition(config.tickDurationMs > 0, "tickDurationMs must be positive");
    this.config = deepFreeze(config);
    this.slotsArr = Array.from({ length: config.slots }, () => []);
  }

  /**
   * Schedules a one-shot callback `delayMs` in the future.
   */
  schedule(delayMs: number, callback: () => void): TimerHandle {
    return this.enqueue(delayMs, 0, callback);
  }

  /**
   * Schedules a repeating callback with initial delay and interval.
   */
  scheduleRecurring(initialDelayMs: number, intervalMs: number, callback: () => void): TimerHandle {
    assertPrecondition(intervalMs >= this.config.tickDurationMs, "interval must be >= tick");
    return this.enqueue(initialDelayMs, Math.round(intervalMs / this.config.tickDurationMs), callback);
  }

  private enqueue(delayMs: number, intervalTicks: number, callback: () => void): TimerHandle {
    assertPrecondition(delayMs >= 0, "delay must be >= 0");
    const deltaTicks = Math.round(delayMs / this.config.tickDurationMs);
    const deadlineTick = this.currentTick + deltaTicks;
    const idx = deadlineTick % this.config.slots;
    const rounds = Math.floor(deltaTicks / this.config.slots);
    const handle: TimerHandle = deepFreeze({ id: ++this.seq, deadlineTick, intervalTicks });
    this.slotsArr[idx].push({ handle, rounds, fire: callback, cancelled: false });
    this.scheduled++;
    return handle;
  }

  cancel(handle: TimerHandle): boolean {
    const idx = handle.deadlineTick % this.config.slots;
    const slot = this.slotsArr[idx].find((s) => s.handle.id === handle.id && !s.cancelled);
    if (!slot) return false;
    slot.cancelled = true;
    this.cancelledCount++;
    return true;
  }

  /**
   * Advances the wheel by `ticks` and fires every due callback.
   */
  advance(ticks = 1): number {
    let firedNow = 0;
    for (let t = 0; t < ticks; t++) {
      this.currentTick++;
      const idx = this.currentTick % this.config.slots;
      const bucket = this.slotsArr[idx];
      const survivors: TimerSlot[] = [];
      for (const s of bucket) {
        if (s.cancelled) continue;
        if (s.rounds > 0) {
          s.rounds--;
          survivors.push(s);
          continue;
        }
        try {
          s.fire();
          firedNow++;
          this.fired++;
        } catch {
          /* swallow user errors */
        }
        if (s.handle.intervalTicks > 0) {
          const nextDeadline = this.currentTick + s.handle.intervalTicks;
          const nextIdx = nextDeadline % this.config.slots;
          this.slotsArr[nextIdx].push({
            handle: s.handle,
            rounds: Math.floor(s.handle.intervalTicks / this.config.slots),
            fire: s.fire,
            cancelled: false,
          });
        }
      }
      this.slotsArr[idx] = survivors;
    }
    return firedNow;
  }

  get tick(): number {
    return this.currentTick;
  }
  get pending(): number {
    return this.slotsArr.reduce((acc, s) => acc + s.filter((x) => !x.cancelled).length, 0);
  }

  telemetry(): { scheduled: number; fired: number; cancelled: number; pending: number } {
    return deepFreeze({
      scheduled: this.scheduled,
      fired: this.fired,
      cancelled: this.cancelledCount,
      pending: this.pending,
    });
  }

  fingerprint(): string {
    const snapshot = this.slotsArr.map((bucket) =>
      bucket
        .filter((s) => !s.cancelled)
        .map((s) => `${s.handle.id}@${s.handle.deadlineTick}`)
        .join(","),
    );
    return pureSha256(snapshot.join("|"));
  }
}
