/**
 * EosHardwareMemoryArena (Layer 0 — Hardware-Sympathetic Memory Arena & Cache-Line Alignment)
 * SPEC-189: Hardware-Sympathetic Memory Arena & Cache-Line Alignment Engine
 * CHANGE-074: Hardware-Sympathetic Memory Arena & Cache-Line Alignment Engine
 *
 * Implements mechanical sympathy principles for Intel, ARM, and Apple Silicon CPUs:
 * - Strict 64-byte L1/L2 cache-line alignment to eliminate false sharing and cache-line splits.
 * - Monotonic bump allocation for high-frequency tick/transaction scopes with O(1) bulk resets.
 * - Pre-allocated power-of-2 slab pooling (64B to 4096B) for reusable zero-copy telemetry buffers.
 * - Deterministic memory zeroization on release (DoD-grade hygiene).
 *
 * Strictly ZERO external runtime dependencies.
 */

import { assertPrecondition, assertPostcondition, assertInvariant } from "./eosKernelPrimitives.ts";

export const CACHE_LINE_BYTES = 64;

export const SLAB_CLASS_SIZES = [64, 128, 256, 512, 1024, 2048, 4096] as const;
export type SlabClassSize = (typeof SLAB_CLASS_SIZES)[number];

/**
 * Rounds an offset or size up to the nearest 64-byte cache-line boundary.
 */
export function alignToCacheLine(offset: number): number {
  return (offset + (CACHE_LINE_BYTES - 1)) & ~(CACHE_LINE_BYTES - 1);
}

export interface BumpArenaStats {
  capacity: number;
  allocatedBytes: number;
  freeBytes: number;
  allocationsCount: number;
}

export interface SlabPoolClassStats {
  classSize: number;
  totalCapacity: number;
  allocatedCount: number;
  freeCount: number;
}

export interface SlabPoolStats {
  totalCapacityBytes: number;
  classes: SlabPoolClassStats[];
}

/**
 * Monotonic linear bump allocator over a pre-allocated contiguous ArrayBuffer.
 * Guaranteed 64-byte alignment on every allocation with O(1) bulk reset.
 */
export class EosBumpArena {
  public readonly capacity: number;
  private _buffer: ArrayBuffer;
  private _offset: number;
  private _allocationsCount: number;

  constructor(capacityBytes: number = 65536) {
    assertPrecondition(capacityBytes > 0, "EosBumpArena: capacity must be greater than 0");
    this.capacity = alignToCacheLine(capacityBytes);
    this._buffer = new ArrayBuffer(this.capacity);
    this._offset = 0;
    this._allocationsCount = 0;

    assertInvariant(this._buffer.byteLength === this.capacity, "Arena buffer size must match aligned capacity");
  }

  /**
   * Allocates a contiguous slice guaranteed to begin at a 64-byte cache-line boundary.
   */
  public allocate(sizeBytes: number): Uint8Array {
    assertPrecondition(sizeBytes > 0, "allocate: sizeBytes must be greater than 0");

    const alignedStart = alignToCacheLine(this._offset);
    const alignedNext = alignToCacheLine(alignedStart + sizeBytes);

    if (alignedNext > this.capacity) {
      throw new Error(
        `[CAPACITY_EXCEEDED] Cannot allocate ${sizeBytes}B (aligned: ${alignedNext}B) from arena of ${this.capacity}B (used: ${this._offset}B)`,
      );
    }

    const view = new Uint8Array(this._buffer, alignedStart, sizeBytes);
    this._offset = alignedNext;
    this._allocationsCount++;

    assertPostcondition(
      view.byteOffset % CACHE_LINE_BYTES === 0,
      "Allocated slice byteOffset must be 64-byte cache-line aligned",
    );
    return view;
  }

  /**
   * Resets the allocation offset to 0 in O(1) time without re-allocating the underlying ArrayBuffer.
   * If zeroize is true, clears memory with 0x00 bytes.
   */
  public reset(zeroize: boolean = true): void {
    if (zeroize && this._offset > 0) {
      new Uint8Array(this._buffer, 0, this._offset).fill(0);
    }
    this._offset = 0;
    this._allocationsCount = 0;
  }

  /**
   * Returns allocator usage statistics.
   */
  public getStats(): BumpArenaStats {
    return {
      capacity: this.capacity,
      allocatedBytes: this._offset,
      freeBytes: this.capacity - this._offset,
      allocationsCount: this._allocationsCount,
    };
  }
}

/**
 * Power-of-two slab pool allocator for reusable zero-copy telemetry buffers.
 * Maintains pre-allocated slabs for sizes 64B, 128B, 256B, 512B, 1024B, 2048B, and 4096B.
 */
export class EosSlabPoolArena {
  private _buffers: Map<number, Uint8Array[]>;
  private _freeLists: Map<number, Uint8Array[]>;
  private _activeAllocations: Set<Uint8Array>;
  private _totalCapacityBytes: number;

  constructor(slabsPerClass: number = 64) {
    assertPrecondition(slabsPerClass > 0, "slabsPerClass must be greater than 0");

    this._buffers = new Map();
    this._freeLists = new Map();
    this._activeAllocations = new Set();
    this._totalCapacityBytes = 0;

    for (const size of SLAB_CLASS_SIZES) {
      const classBufferLength = size * slabsPerClass;
      const underlyingBuffer = new ArrayBuffer(classBufferLength);
      const slabs: Uint8Array[] = [];
      const freeList: Uint8Array[] = [];

      for (let i = 0; i < slabsPerClass; i++) {
        const slab = new Uint8Array(underlyingBuffer, i * size, size);
        assertInvariant(slab.byteOffset % CACHE_LINE_BYTES === 0, "Slab byteOffset must be 64-byte cache-line aligned");
        slabs.push(slab);
        freeList.push(slab);
      }

      this._buffers.set(size, slabs);
      this._freeLists.set(size, freeList);
      this._totalCapacityBytes += classBufferLength;
    }
  }

  /**
   * Allocates a slab from the smallest power-of-two class capable of holding sizeBytes.
   */
  public allocate(sizeBytes: number): Uint8Array {
    assertPrecondition(sizeBytes > 0, "allocate: sizeBytes must be greater than 0");
    assertPrecondition(sizeBytes <= 4096, "allocate: sizeBytes cannot exceed 4096B in slab pool");

    const classSize = this._findClassSize(sizeBytes);
    const freeList = this._freeLists.get(classSize);

    if (!freeList || freeList.length === 0) {
      throw new Error(`[SLAB_EXHAUSTED] No free slabs remaining in class size ${classSize}B`);
    }

    const slab = freeList.pop()!;
    this._activeAllocations.add(slab);

    assertPostcondition(slab.byteOffset % CACHE_LINE_BYTES === 0, "Slab byteOffset must be 64-byte cache-line aligned");
    return slab;
  }

  /**
   * Releases an allocated slab back to its class free-list and zeroizes its memory.
   */
  public release(slab: Uint8Array): void {
    assertPrecondition(Boolean(slab), "release: slab cannot be null or undefined");

    if (!this._activeAllocations.has(slab)) {
      return; // Idempotent or already released
    }

    // Zeroize memory to prevent sensitive telemetry or cryptographic residue
    slab.fill(0);
    this._activeAllocations.delete(slab);

    const classSize = slab.byteLength;
    const freeList = this._freeLists.get(classSize);
    if (freeList) {
      freeList.push(slab);
    }
  }

  /**
   * Returns diagnostics for all slab classes.
   */
  public getStats(): SlabPoolStats {
    const classes: SlabPoolClassStats[] = [];

    for (const size of SLAB_CLASS_SIZES) {
      const allSlabs = this._buffers.get(size) ?? [];
      const freeSlabs = this._freeLists.get(size) ?? [];
      classes.push({
        classSize: size,
        totalCapacity: allSlabs.length,
        allocatedCount: allSlabs.length - freeSlabs.length,
        freeCount: freeSlabs.length,
      });
    }

    return {
      totalCapacityBytes: this._totalCapacityBytes,
      classes,
    };
  }

  private _findClassSize(sizeBytes: number): SlabClassSize {
    for (const size of SLAB_CLASS_SIZES) {
      if (sizeBytes <= size) return size;
    }
    return 4096;
  }
}

/**
 * Unified Hardware-Sympathetic Memory Arena Orchestrator
 */
export class EosHardwareMemoryArena {
  public readonly bump: EosBumpArena;
  public readonly slabs: EosSlabPoolArena;

  constructor(bumpCapacityBytes: number = 65536, slabsPerClass: number = 64) {
    this.bump = new EosBumpArena(bumpCapacityBytes);
    this.slabs = new EosSlabPoolArena(slabsPerClass);
  }

  /**
   * Helper to execute a transient operation within a scoped bump arena with automatic reset.
   */
  public withScope<T>(fn: (arena: EosBumpArena) => T): T {
    try {
      return fn(this.bump);
    } finally {
      this.bump.reset(true);
    }
  }
}
