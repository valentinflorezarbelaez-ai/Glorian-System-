/**
 * EOS SYSTEM — ZERO-ALLOCATION SLAB BUFFER POOL (Layer 0)
 * Governed by ADR-039, SPEC-032, FR-091, BDD-079
 *
 * Implements a high-concurrency slab allocator (Netty / Chromium style):
 * - Eliminates V8 Garbage Collection pause times in streaming & WAL serialization
 * - Pre-allocated fixed-size slabs in O(1) LIFO stack
 * - Safe acquire and release lifecycle with automatic zeroing
 * - Real-time statistics tracking pool hit rates and spill counts
 *
 * Invariant: 100% Layer-0 purity with zero external npm dependencies.
 */

export interface BufferPoolOptions {
  slabSize?: number; // Default 4096 bytes (4KB)
  capacity?: number; // Default 64 slabs (256KB pre-allocated)
}

export interface BufferPoolStats {
  slabSizeBytes: number;
  totalCapacity: number;
  availableSlabs: number;
  inUseSlabs: number;
  totalAcquires: number;
  totalReleases: number;
  poolHitRatePercent: number;
  spillCount: number;
}

export class EosBufferPool {
  public readonly slabSize: number;
  public readonly capacity: number;
  private readonly stack: Uint8Array[];
  private acquires = 0;
  private releases = 0;
  private spills = 0;

  constructor(options?: BufferPoolOptions) {
    this.slabSize = options?.slabSize ?? 4096;
    this.capacity = options?.capacity ?? 64;
    this.stack = new Array(this.capacity);

    // Pre-allocate fixed slabs in memory
    for (let i = 0; i < this.capacity; i++) {
      this.stack[i] = new Uint8Array(this.slabSize);
    }
  }

  /**
   * Acquires a pre-allocated slab buffer in O(1) time.
   */
  public acquire(): Uint8Array {
    this.acquires++;
    if (this.stack.length > 0) {
      return this.stack.pop()!;
    }
    // Spill: Allocate emergency slab if pool is completely exhausted
    this.spills++;
    return new Uint8Array(this.slabSize);
  }

  /**
   * Releases an acquired slab buffer back to the pool in O(1) time.
   */
  public release(slab: Uint8Array): void {
    if (!slab || slab.byteLength !== this.slabSize) {
      return; // Ignore mismatched buffer
    }

    this.releases++;
    // Zero out memory if needed and push back if capacity allows
    if (this.stack.length < this.capacity) {
      slab.fill(0);
      this.stack.push(slab);
    }
  }

  /**
   * Returns telemetry metrics for the buffer pool.
   */
  public getStats(): BufferPoolStats {
    const hits = this.acquires - this.spills;
    const hitRate = this.acquires > 0 ? Number(((hits / this.acquires) * 100).toFixed(2)) : 100;

    return {
      slabSizeBytes: this.slabSize,
      totalCapacity: this.capacity,
      availableSlabs: this.stack.length,
      inUseSlabs: Math.max(0, this.capacity - this.stack.length),
      totalAcquires: this.acquires,
      totalReleases: this.releases,
      poolHitRatePercent: hitRate,
      spillCount: this.spills,
    };
  }

  /**
   * Resets the buffer pool to initial state.
   */
  public reset(): void {
    this.stack.length = 0;
    for (let i = 0; i < this.capacity; i++) {
      this.stack.push(new Uint8Array(this.slabSize));
    }
    this.acquires = 0;
    this.releases = 0;
    this.spills = 0;
  }
}
