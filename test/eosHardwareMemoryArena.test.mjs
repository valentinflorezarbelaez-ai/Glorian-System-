/**
 * Test Suite: EosHardwareMemoryArena (Layer 0 — Hardware-Sympathetic Memory Arena & Cache-Line Alignment)
 * SPEC-189: Hardware-Sympathetic Memory Arena & Cache-Line Alignment Engine
 * CHANGE-074: Hardware-Sympathetic Memory Arena & Cache-Line Alignment Engine
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EosHardwareMemoryArena,
  EosBumpArena,
  EosSlabPoolArena,
  alignToCacheLine,
  CACHE_LINE_BYTES,
} from "../src/core/eosHardwareMemoryArena.ts";

describe("SPEC-189: EosHardwareMemoryArena", () => {
  it("BDD-963: guarantees strict 64-byte cache-line alignment for arbitrary allocation sizes", () => {
    const arena = new EosBumpArena(8192);

    const sizes = [17, 30, 64, 120, 250, 512, 1000];
    const views = sizes.map((s) => arena.allocate(s));

    for (const view of views) {
      assert.equal(
        view.byteOffset % CACHE_LINE_BYTES,
        0,
        `Allocation byteOffset (${view.byteOffset}) must be divisible by 64`,
      );
    }

    assert.equal(alignToCacheLine(0), 0);
    assert.equal(alignToCacheLine(1), 64);
    assert.equal(alignToCacheLine(63), 64);
    assert.equal(alignToCacheLine(64), 64);
    assert.equal(alignToCacheLine(65), 128);
  });

  it("BDD-964: power-of-two slab pooling returns 64-byte aligned slabs and reuses buffers", () => {
    const pool = new EosSlabPoolArena(16);

    // Allocate 100 bytes -> selects 128-byte slab class
    const slab1 = pool.allocate(100);
    assert.equal(slab1.byteLength, 128);
    assert.equal(slab1.byteOffset % CACHE_LINE_BYTES, 0);

    // Fill with data
    slab1.fill(0xaa);

    const statsBefore = pool.getStats();
    const class128Before = statsBefore.classes.find((c) => c.classSize === 128);
    assert.equal(class128Before?.allocatedCount, 1);
    assert.equal(class128Before?.freeCount, 15);

    // Release slab
    pool.release(slab1);

    const statsAfter = pool.getStats();
    const class128After = statsAfter.classes.find((c) => c.classSize === 128);
    assert.equal(class128After?.allocatedCount, 0);
    assert.equal(class128After?.freeCount, 16);

    // Allocate again -> must reuse the same recycled slab
    const slab2 = pool.allocate(120);
    assert.equal(slab2.byteLength, 128);
    assert.equal(slab2.byteOffset, slab1.byteOffset);
  });

  it("BDD-965: monotonic bump allocation and O(1) bulk reset", () => {
    const arena = new EosBumpArena(4096);

    // 4 allocations of 256 bytes
    for (let i = 0; i < 4; i++) {
      arena.allocate(256);
    }

    const stats = arena.getStats();
    assert.equal(stats.allocationsCount, 4);
    assert.equal(stats.allocatedBytes, 1024);
    assert.equal(stats.freeBytes, 3072);

    // Reset without re-allocating
    arena.reset(true);

    const statsReset = arena.getStats();
    assert.equal(statsReset.allocationsCount, 0);
    assert.equal(statsReset.allocatedBytes, 0);
    assert.equal(statsReset.freeBytes, 4096);

    // Next allocation begins back at offset 0
    const first = arena.allocate(64);
    assert.equal(first.byteOffset, 0);
  });

  it("BDD-966: deterministic memory zeroization on slab release and arena reset", () => {
    const pool = new EosSlabPoolArena(8);
    const slab = pool.allocate(200); // 256B slab

    // Write sensitive data
    slab.fill(0xff);
    assert.equal(slab[0], 0xff);
    assert.equal(slab[100], 0xff);

    // Release should zeroize memory
    pool.release(slab);
    assert.equal(slab[0], 0x00);
    assert.equal(slab[100], 0x00);
    assert.equal(slab[255], 0x00);

    // Verify bump arena zeroization on reset
    const bump = new EosBumpArena(512);
    const slice = bump.allocate(100);
    slice.fill(0xee);
    assert.equal(slice[50], 0xee);

    bump.reset(true);
    assert.equal(slice[50], 0x00);
  });

  it("BDD-967: capacity exhaustion safety throws clean error", () => {
    const arena = new EosBumpArena(256);

    arena.allocate(128);
    arena.allocate(64);

    // Exceeds remaining capacity (only 64 bytes left, asking for 128)
    assert.throws(() => arena.allocate(128), /CAPACITY_EXCEEDED/);

    // Pool exhaustion
    const pool = new EosSlabPoolArena(2);
    pool.allocate(64);
    pool.allocate(64);

    // 3rd allocation from class 64 should throw SLAB_EXHAUSTED
    assert.throws(() => pool.allocate(64), /SLAB_EXHAUSTED/);
  });

  it("withScope: executes scoped callback and resets arena automatically", () => {
    const hardware = new EosHardwareMemoryArena(1024, 8);

    const result = hardware.withScope((arena) => {
      const buf = arena.allocate(256);
      buf[0] = 42;
      return buf[0] * 2;
    });

    assert.equal(result, 84);
    // Arena was automatically reset
    assert.equal(hardware.bump.getStats().allocatedBytes, 0);
  });
});
