# INTAKE-116 — Layer-0 Cuckoo Filter for Dynamic Set Membership and Verifiable Deletion

## Metadata

- **Intake ID**: INTAKE-116
- **Change ID**: CHANGE-116
- **SPEC ID**: SPEC-231
- **Author**: EOS Engineering System
- **Date**: 2026-11-12
- **Status**: INTAKE_COMPLETE
- **Priority**: HIGH
- **Layer**: Layer-0 (Zero external runtime dependencies)

## Business Context

The Glorian System coordinates peer routing tables, distributed telemetry deduplication, transaction caches,
and edge storage filters across the 9 fleet repositories. These subsystems require high-throughput, low-memory
probabilistic set-membership checks with $O(1)$ query times. Standard Bloom filters are inadequate because
they cannot delete elements without rebuilding the entire filter and exhibit poor cache locality.

## Problem Statement

1. **Inability to delete expired or revoked elements**: Bloom filters cannot remove items; counting Bloom
   filters consume $4\times$ to $8\times$ more memory and remain prone to counter overflows.
2. **Suboptimal space efficiency**: Standard filters require 10–14 bits per item for a 1% false positive
   probability. Modern systems require sub-byte footprint per item.
3. **Lack of partial-key displacement**: Relocating items during hash collisions traditionally requires
   re-hashing the original key, which cannot be stored in space-constrained filters.
4. **Poor serialization performance**: Transporting filter state over the peer mesh requires compact,
   zero-copy binary encoding.

## Proposed Solution

Implement `EosCuckooFilterCore` — a pure Layer-0 TypeScript engine delivering:

- **Partial-Key Cuckoo Hashing**:
  - $i_1 = \text{hash}(x) \pmod m$
  - $i_2 = (i_1 \oplus \text{hash}(fp)) \pmod m$
  - Fingerprints of 1 or 2 bytes enable dynamic relocation without retaining original keys.
- **True Dynamic Deletion**:
  - `delete(item)` locates and safely frees the fingerprint slot with zero false negatives.
- **High Occupancy**:
  - 4 slots per bucket achieving $> 95\%$ load factor before saturation.
- **Compact TypedArray Backing**:
  - `Uint8Array` or `Uint16Array` storage with sub-millisecond serialization.

## Constraints

- Zero external runtime dependencies (`dependencies: {}` in `package.json`).
- Pure TypeScript / Node.js 24 built-ins only (`node:crypto` for 64-bit/32-bit hashing).
- Deterministic behavior and bounded displacement walks (`maxKicks` ceiling).
