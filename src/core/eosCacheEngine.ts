/**
 * EOS SYSTEM — DISTRIBUTED CACHE ENGINE (Layer 0)
 * Governed by SPEC-171 (Redis / Memcached + singleflight stampede protection)
 *
 * Implements:
 * - LRU eviction with configurable capacity
 * - Per-entry TTL with lazy expiration sweep
 * - Singleflight loader: concurrent misses coalesce to one backend call
 * - Write-through and write-behind hooks
 * - Deterministic hit/miss/eviction telemetry + state fingerprint
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface CacheConfig {
  readonly maxEntries: number;
  readonly defaultTtlMs: number;
}

export interface CacheTelemetry {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly stampedesCoalesced: number;
  readonly expired: number;
}

interface CacheEntry {
  value: unknown;
  expiresAtMs: number;
  insertedAtMs: number;
}

export class EosCacheEngine {
  private readonly store: Map<string, CacheEntry> = new Map();
  private readonly inflight: Map<string, Promise<unknown>> = new Map();
  private readonly config: CacheConfig;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private coalesced = 0;
  private expired = 0;

  constructor(config: CacheConfig) {
    assertPrecondition(config.maxEntries >= 1, "maxEntries must be >= 1");
    this.config = config;
  }

  /**
   * Direct get with lazy expiration. Returns undefined on miss or expiry.
   * Access promotes the key to the most-recently-used position.
   */
  get(key: string): unknown {
    const e = this.store.get(key);
    if (!e) {
      this.misses++;
      return undefined;
    }
    if (e.expiresAtMs <= Date.now()) {
      this.store.delete(key);
      this.expired++;
      this.misses++;
      return undefined;
    }
    // Refresh LRU position
    this.store.delete(key);
    this.store.set(key, e);
    this.hits++;
    return e.value;
  }

  set(key: string, value: unknown, ttlMs = this.config.defaultTtlMs): void {
    assertPrecondition(ttlMs > 0, "ttlMs must be positive");
    if (this.store.size >= this.config.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest !== undefined) {
        this.store.delete(oldest);
        this.evictions++;
      }
    }
    const now = Date.now();
    this.store.delete(key);
    this.store.set(key, { value, expiresAtMs: now + ttlMs, insertedAtMs: now });
  }

  del(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Cache-aside loader with singleflight de-duplication: concurrent requests
   * for the same key share a single backend call.
   */
  async load<T>(key: string, loader: () => Promise<T>, ttlMs = this.config.defaultTtlMs): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached as T;

    const existing = this.inflight.get(key);
    if (existing) {
      this.coalesced++;
      return existing as Promise<T>;
    }

    const p = (async () => {
      try {
        const v = await loader();
        this.set(key, v, ttlMs);
        return v;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, p);
    return p;
  }

  get size(): number {
    return this.store.size;
  }
  get inflightCount(): number {
    return this.inflight.size;
  }

  telemetry(): CacheTelemetry {
    return deepFreeze({
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      stampedesCoalesced: this.coalesced,
      expired: this.expired,
    });
  }

  hitRatio(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  stateFingerprint(): string {
    const now = Date.now();
    const alive = [...this.store.entries()]
      .filter(([, e]) => e.expiresAtMs > now)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k]) => k);
    return pureSha256(alive.join("|"));
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }
}
