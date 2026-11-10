# SPEC-189: Hardware-Sympathetic Memory Arena & Cache-Line Alignment Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Infrastructure
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / Mechanical Sympathy / L1-L2 64-Byte Alignment
- **Module**: `src/core/eosHardwareMemoryArena.ts`
- **Composes**: SPEC-015 (LMAX Disruptor), SPEC-032 (V8 TurboFan), SPEC-041 (Kernel Primitives)

---

## 1. Context and Rationale

Modern silicon architectures (Intel, AMD, ARM, Apple Silicon, NVIDIA GPUs) organize memory in 64-byte cache lines. When memory allocations cross cache-line boundaries or produce scattered heap allocations, processors experience false sharing, cache misses, and pipeline stalls. Furthermore, runtime garbage collection creates unbounded latency spikes.

This specification implements `EosHardwareMemoryArena`, establishing hardware-sympathetic pre-allocated memory pools where every allocation is guaranteed to be 64-byte aligned, slab-pooled across power-of-two classes, and reusable with zero steady-state heap churn (0 B/op).

---

## 2. Functional Requirements (EARS Syntax)

- **FR-963 (Ubiquitous - 64-Byte Cache-Line Alignment)**: `THE SYSTEM SHALL guarantee that every memory slice allocated from the arena begins at a byte offset that is an integer multiple of 64 bytes.`

- **FR-964 (Ubiquitous - Power-of-Two Slab Pooling)**: `THE SYSTEM SHALL maintain pre-allocated slab pools for sizes 64B, 128B, 256B, 512B, 1024B, 2048B, and 4096B, returning recycled slices in O(1) time without heap allocation.`

- **FR-965 (Event-Driven - Bump Allocation and Bulk Reset)**: `WHEN a burst of short-lived buffers is required, THE SYSTEM SHALL support bump allocation with an O(1) reset that rewinds the allocation pointer without freeing the underlying ArrayBuffer.`

- **FR-966 (Event-Driven - Deterministic Zeroization)**: `WHEN a slab is released or the arena is reset, THE SYSTEM SHALL zeroize the released memory region to prevent data bleed across reuse cycles.`

- **FR-967 (Ubiquitous - Zero Dependencies)**: `THE SYSTEM SHALL execute all arena pooling, pointer arithmetic, and zeroization using native JavaScript typed arrays and Node.js standard modules.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-963 64-byte cache-line alignment
  GIVEN an EosHardwareMemoryArena instance
  WHEN arbitrary size slices (e.g., 30 bytes, 120 bytes, 500 bytes) are allocated
  THEN every returned Uint8Array view has byteOffset % 64 === 0

SCENARIO: BDD-964 Slab pool allocation and recycle
  GIVEN an arena with initialized slab classes
  WHEN a 128-byte block is allocated and subsequently released
  THEN the block is returned to the 128-byte free-list
  AND a subsequent 128-byte allocation reuses the exact same buffer without heap churn

SCENARIO: BDD-965 Monotonic bump allocation and O(1) reset
  GIVEN a bump arena with capacity 65536 bytes
  WHEN 10 sequential allocations of 256 bytes are performed
  THEN total allocated bytes equals 2560
  WHEN reset() is invoked
  THEN allocated bytes is reset to 0
  AND subsequent allocations start at offset 0

SCENARIO: BDD-966 Deterministic zeroization on release
  GIVEN an allocated slab filled with non-zero byte values (0xFF)
  WHEN the slab is released
  THEN all bytes in the slab are overwritten with 0x00

SCENARIO: BDD-967 Capacity exhaustion safety
  GIVEN an arena with fixed capacity
  WHEN an allocation exceeds the remaining capacity
  THEN the system throws a descriptive ContractError without corrupting internal state
```
