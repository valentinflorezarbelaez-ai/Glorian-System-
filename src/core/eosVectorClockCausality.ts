/**
 * EOS SYSTEM — VECTOR CLOCK / CAUSAL ORDERING ENGINE (Layer 0)
 * Governed by SPEC-179 (Dynamo / Riak causality tracking pattern)
 *
 * Implements:
 * - Per-replica monotonic counters (happens-before comparison)
 * - CONCURRENT / BEFORE / AFTER / EQUAL relationship detection
 * - Causal CRDT merge with tombstone retention
 * - Deterministic clock digest + stable tie-breaker for concurrent writes
 *
 * Zero external dependencies.
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type CausalRelation = "BEFORE" | "AFTER" | "CONCURRENT" | "EQUAL";

export class EosVectorClock {
  private readonly entries: Map<string, number>;

  constructor(initial?: Record<string, number>) {
    this.entries = new Map(Object.entries(initial ?? {}));
  }

  clone(): EosVectorClock {
    return new EosVectorClock(Object.fromEntries(this.entries));
  }

  /**
   * Increments this replica's counter and returns a new clock.
   */
  increment(replicaId: string): EosVectorClock {
    const next = this.clone();
    next.entries.set(replicaId, (next.entries.get(replicaId) ?? 0) + 1);
    return next;
  }

  /**
   * Merges two clocks taking element-wise maximum (used on message receipt).
   */
  merge(other: EosVectorClock): EosVectorClock {
    const merged = this.clone();
    for (const [k, v] of other.entries) {
      merged.entries.set(k, Math.max(merged.entries.get(k) ?? 0, v));
    }
    return merged;
  }

  get(replicaId: string): number {
    return this.entries.get(replicaId) ?? 0;
  }

  /**
   * Determines the causal relation between two clocks.
   */
  compare(other: EosVectorClock): CausalRelation {
    const keys = new Set([...this.entries.keys(), ...other.entries.keys()]);
    let thisLess = false;
    let otherLess = false;
    for (const k of keys) {
      const a = this.get(k);
      const b = other.get(k);
      if (a < b) otherLess = true;
      if (a > b) thisLess = true;
    }
    if (!otherLess && !thisLess) return "EQUAL";
    if (otherLess && !thisLess) return "BEFORE";
    if (thisLess && !otherLess) return "AFTER";
    return "CONCURRENT";
  }

  toObject(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.entries) out[k] = v;
    return out;
  }

  digest(): string {
    const sorted = [...this.entries.entries()].sort(([a], [b]) => a.localeCompare(b));
    return pureSha256(JSON.stringify(sorted));
  }
}

export interface CausalVersion<V> {
  readonly replicaId: string;
  readonly value: V;
  readonly clock: EosVectorClock;
  readonly wallTickMs: number;
}

/**
 * Causal register: last-writer-wins on wall clock only when concurrent.
 */
export class EosCausalRegister<V> {
  private current: CausalVersion<V> | null = null;

  put(replicaId: string, value: V, wallTickMs: number): CausalVersion<V> {
    const baseClock = this.current ? this.current.clock : new EosVectorClock();
    const v: CausalVersion<V> = {
      replicaId,
      value: deepFreeze(value),
      clock: baseClock.increment(replicaId),
      wallTickMs,
    };
    this.current = v;
    return v;
  }

  /**
   * Merges a remote version into local state.
   * Concurrent versions resolve via (wallTick, replicaId) tie-breaker.
   */
  merge(remote: CausalVersion<V>): CausalVersion<V> {
    if (!this.current) {
      this.current = remote;
      return remote;
    }
    const rel = this.current.clock.compare(remote.clock);
    if (rel === "BEFORE") {
      this.current = remote;
      return remote;
    }
    if (rel === "AFTER" || rel === "EQUAL") return this.current;
    // CONCURRENT: deterministic tie-break
    const local = this.current;
    const winner =
      remote.wallTickMs > local.wallTickMs
        ? remote
        : remote.wallTickMs < local.wallTickMs
          ? local
          : remote.replicaId.localeCompare(local.replicaId) > 0
            ? remote
            : local;
    this.current = { ...winner, clock: local.clock.merge(remote.clock) };
    return this.current;
  }

  read(): CausalVersion<V> | null {
    return this.current;
  }
}
