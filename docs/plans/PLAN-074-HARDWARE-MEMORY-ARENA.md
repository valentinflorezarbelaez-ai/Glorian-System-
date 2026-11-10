# PLAN-074: Hardware-Sympathetic Memory Arena & Cache-Line Alignment Engine

- **Owner**: Valentín Flórez Arbeláez (Architect & Owner)
- **Status**: APPROVED
- **Date**: 2026-11-10
- **Governed by**: SPEC-189, CHANGE-074

## 1. Architectural Strategy

Implement `src/core/eosHardwareMemoryArena.ts`:

1. **Underlying Storage**: Pre-allocated contiguous `ArrayBuffer` with total capacity rounded up to a multiple of 64 bytes.
2. **Alignment Guarantee**: All allocation pointers are aligned using bitwise formula:
   `alignedOffset = (offset + 63) & ~63`.
3. **Dual Allocation Model**:
   - **Bump Arena (`EosBumpArena`)**: Rapid linear allocations for transaction/tick scopes with $O(1)$ bulk reset.
   - **Slab Pool Arena (`EosSlabPoolArena`)**: Fixed power-of-2 size classes (64, 128, 256, 512, 1024, 2048, 4096) with intrusive or index-based free lists for reusable buffers.
4. **Zeroization on Free**: Wipes buffers with `buffer.fill(0)` on release or reset to prevent sensitive data leaks.
5. **Zero External Dependencies**: Implemented strictly with standard TypedArray primitives and Design by Contract invariants.
