# CHANGE-180: FlashAttention-Style Online Softmax Tiling & Block-Paged Attention Kernel

**Status**: `PROPOSED`
**Specification**: `SPEC-318`
**Intake Reference**: `INTAKE-180`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Intent & Scope

Provide a memory-efficient FlashAttention-style attention forward kernel that processes sequences through tiled block multiplication ($B_r, B_c$) and online softmax rescaling, bounding auxiliary memory to $O(B \cdot d)$ instead of $O(N^2)$ and operating seamlessly on non-contiguous paged KV-cache blocks.

## 2. Delta Specification

- **Add**: `src/core/eosFlashAttentionOnlineSoftmax.types.ts`
  - Types for query/key/value tensor tiles, running statistics (`runningMax` $m$, `runningSum` $l$, `accumulatedOutput` $O$), tiling configuration (`blockSizeRow`, `blockSizeCol`, `headDim`, `isCausal`), and audit receipt.
- **Add**: `src/core/eosFlashAttentionOnlineSoftmax.ts`
  - Core implementation `EosFlashAttentionOnlineSoftmaxCore` providing:
    - Tile-based matrix multiply ($Q_i K_j^T$) with $\sqrt{d}$ scaling.
    - Online softmax running update with numerical stabilization $\exp(S - m)$.
    - Running accumulator normalization $O_i / l_i$.
    - Causal masking with block-skipping optimization.
    - Comparison / parity verification against standard non-tiled attention.
- **Add**: `bin/commands/cliFlashAttentionOnlineSoftmax.mjs`
  - 5 CLI commands for tiling inspect, online softmax step, full forward pass, parity audit, and receipt emission.
- **Add**: `docs/formal/FlashAttentionOnlineSoftmax.tla` & `.cfg` (Model 62)
  - Formal TLA+ specification model checking numerical invariants, positive normalizer, and block conservation.
- **Add**: `test/eosFlashAttentionOnlineSoftmax.test.mjs`
  - BDD test scenarios `BDD-1683` through `BDD-1688`.

## 3. Backward Compatibility

- 100% non-breaking; fully additive.
- Interfaces smoothly with existing `EosSpeculativePagedKvCacheCore` (`SPEC-317`) for block addressing.
