# Intake & Context: FlashAttention-Style Online Softmax Tiling & Block-Paged Attention Kernel

**Identifier**: `INTAKE-180`
**Target Specification**: `SPEC-318`
**Target Change**: `CHANGE-180`
**Status**: `INTAKE_APPROVED`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Problem Statement & Motivation

Standard transformer attention computation $\text{Softmax}(Q K^T / \sqrt{d}) V$ poses an $O(N^2)$ memory bottleneck:

1. For sequence lengths $N \ge 32\text{k}$ to $128\text{k}+$, materializing the full attention score matrix $S \in \mathbb{R}^{N \times N}$ requires hundreds of megabytes to gigabytes of contiguous RAM/VRAM per attention head.
2. In GPU/accelerator architectures and multi-core CPU architectures, memory bandwidth (HBM / DRAM to SRAM / L1/L2 cache) is the primary throughput limiter (memory-bound kernel), not raw FLOPs.
3. Standard three-pass softmax ($\max$, $\sum \exp$, division) forces repeated reads and writes of the large intermediate matrix to high-latency memory.

## 2. Architectural Solution

Implement a pure TypeScript / WebAssembly-ready FlashAttention-style tiled attention engine (`EosFlashAttentionOnlineSoftmaxCore`) that:

1. **Tiles Inputs**: Partitions $Q$ into blocks of size $B_r \times d$ and $K, V$ into blocks of size $B_c \times d$ fitting entirely within fast local memory/SRAM cache line budgets ($B_r, B_c \in \{16, 32, 64\}$).
2. **Online Softmax Rescaling**: Leverages the online normalizer update (Milakov & Gimelshein, Rabe & Staats, Dao et al.):
   $$m_i^{(j)} = \max(m_i^{(j-1)}, \max_k S_{ik}^{(j)})$$
   $$P_{ik}^{(j)} = \exp(S_{ik}^{(j)} - m_i^{(j)})$$
   $$l_i^{(j)} = \exp(m_i^{(j-1)} - m_i^{(j)}) \cdot l_i^{(j-1)} + \sum_k P_{ik}^{(j)}$$
   $$O_i^{(j)} = \exp(m_i^{(j-1)} - m_i^{(j)}) \cdot O_i^{(j-1)} + P_{i}^{(j)} V_j$$
   $$O_i^{(\text{final})} = \frac{1}{l_i} O_i$$
3. **Causal Masking Support**: Efficiently skips upper-triangular tiles where $j \cdot B_c > (i + 1) \cdot B_r$, cutting compute by $50\%$ on autoregressive generation.
4. **Integration with Paged KV-Cache (`SPEC-317`)**: Ingests logical sequence token indices mapped across physical page table blocks directly without flattening into contiguous tensors.
5. **Zero External Runtime Dependencies**: Pure Node 24 strip-only TypeScript conforming to `dependencies: {}`.

## 3. Success Metrics & Verification Criteria

1. **Mathematical Equivalence**: Maximum absolute error between FlashAttention online output and naive $O(N^2)$ attention $\epsilon < 10^{-5}$ (IEEE 754 float32 precision).
2. **Working Memory Bound**: Additional workspace memory strictly $O(B_r \cdot d + B_c \cdot d)$ independent of sequence length $N$.
3. **Formal Verification (TLC Model 62)**: State space verification confirming numerical stability, monotonic running maximums, non-zero normalizers, and block loop termination.
4. **CLI Parity**: 5 new commands (`toolchain:flash:*`) registered in catalog and developer guide with `return true` for clean `--json`.
5. **BDD Suite**: 6 scenarios (`BDD-1683`..`BDD-1688`) passing 100% with signed cryptographic SHA-256 receipt.
