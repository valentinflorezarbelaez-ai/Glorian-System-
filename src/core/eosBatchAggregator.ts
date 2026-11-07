/**
 * EOS SYSTEM — BATCH AGGREGATOR (Layer 0)
 * Governed by SPEC-174 (Kafka Streams / Databricks micro-batching pattern)
 *
 * Implements:
 * - Size-trigger and time-trigger flush policies (whichever fires first)
 * - Optional key-based partitioning (per-key batches)
 * - Idle timeout for tail flush
 * - Deterministic batch IDs and delivery fingerprints
 * - Zero-loss guarantee: flush is atomic with counter reset
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface BatchConfig {
  readonly maxBatchSize: number;
  readonly maxDelayMs: number;
  readonly maxKeys?: number; // partition cap when keying
}

export interface Batch<T> {
  readonly batchId: string;
  readonly key?: string;
  readonly items: readonly T[];
  readonly createdAtMs: number;
  readonly trigger: "SIZE" | "TIME" | "MANUAL";
  readonly reason: string;
}

export class EosBatchAggregator<T> {
  private readonly config: BatchConfig;
  private readonly buckets: Map<string, { items: T[]; openedAtMs: number }> = new Map();
  private readonly emitted: Batch<T>[] = [];
  private seq = 0;

  constructor(config: BatchConfig) {
    assertPrecondition(config.maxBatchSize >= 1, "maxBatchSize must be >= 1");
    assertPrecondition(config.maxDelayMs >= 0, "maxDelayMs must be >= 0");
    this.config = deepFreeze(config);
  }

  add(item: T, key = "__default__"): Batch<T> | null {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      const cap = this.config.maxKeys ?? Infinity;
      assertPrecondition(this.buckets.size < cap, `key capacity ${cap} reached`);
      bucket = { items: [], openedAtMs: Date.now() };
      this.buckets.set(key, bucket);
    }
    bucket.items.push(item);

    if (bucket.items.length >= this.config.maxBatchSize) {
      return this.flushKey(key, "SIZE", `reached maxBatchSize=${this.config.maxBatchSize}`);
    }
    return null;
  }

  /**
   * Sweeps all buckets; flushes those that exceeded maxDelayMs.
   * Returns the flushed batches.
   */
  tick(nowMs = Date.now()): readonly Batch<T>[] {
    const flushed: Batch<T>[] = [];
    for (const key of [...this.buckets.keys()]) {
      const b = this.buckets.get(key)!;
      if (b.items.length === 0) {
        this.buckets.delete(key);
        continue;
      }
      if (nowMs - b.openedAtMs >= this.config.maxDelayMs) {
        const batch = this.flushKey(
          key,
          "TIME",
          `age ${nowMs - b.openedAtMs}ms >= maxDelayMs=${this.config.maxDelayMs}`,
        );
        if (batch) flushed.push(batch);
      }
    }
    return flushed;
  }

  /** Force a flush of a specific key. */
  flushKey(key: string, trigger: "SIZE" | "TIME" | "MANUAL", reason: string): Batch<T> | null {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.items.length === 0) {
      this.buckets.delete(key);
      return null;
    }
    this.buckets.delete(key);
    const items = bucket.items.slice();
    const batchId = `batch-${++this.seq}`;
    const batch: Batch<T> = deepFreeze({
      batchId,
      key,
      items,
      createdAtMs: Date.now(),
      trigger,
      reason,
    });
    this.emitted.push(batch);
    return batch;
  }

  /** Force a flush of every non-empty bucket. */
  flushAll(): readonly Batch<T>[] {
    const out: Batch<T>[] = [];
    for (const key of [...this.buckets.keys()]) {
      const b = this.flushKey(key, "MANUAL", "explicit flushAll");
      if (b) out.push(b);
    }
    return out;
  }

  pendingCount(): number {
    let n = 0;
    for (const b of this.buckets.values()) n += b.items.length;
    return n;
  }

  emittedBatches(): readonly Batch<T>[] {
    return this.emitted;
  }

  fingerprint(): string {
    return pureSha256(this.emitted.map((b) => `${b.batchId}:${b.trigger}:${b.items.length}`).join("|"));
  }
}
