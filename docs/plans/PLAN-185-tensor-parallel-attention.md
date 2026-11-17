# PLAN-185: Tensor Parallel Multi-Head & Grouped-Query Attention (TP-MHA / TP-GQA) with Sequence Parallelism & Ring Attention

**Reference**: `SPEC-323` / `CHANGE-185`  
**System**: Glorian System Control Plane (`eos-system`)  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Architectural Overview

Tensor Parallel Attention shards the core self-attention computation across $P$ workers by exploiting the independence of attention heads in Multi-Head Attention (MHA) and Grouped-Query Attention (GQA).

```
                      Input Tensor X [B, S, d]
                           | (Broadcast / Replicated)
             +-------------+-------------+
             |                           |
        Worker 0                    Worker 1
   [H_Q/P, H_KV/P heads]       [H_Q/P, H_KV/P heads]
             |                           |
      Q^(0), K^(0), V^(0)         Q^(1), K^(1), V^(1)
             |                           |
       Local Attention             Local Attention
         (Flash/Online)              (Flash/Online)
             |                           |
          A^(0)                       A^(1)
             |                           |
     Row-Proj W_O^(0)            Row-Proj W_O^(1)
             |                           |
          O^(0)                       O^(1)
             +-------------+-------------+
                           |
               Collective All-Reduce: O = Sum_p O^(p)
                           |
                 Output Tensor O [B, S, d]
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-185-001: Head-Wise Sharding vs Spatial Tensor Sharding

- **Context**: Attention can be sharded along the hidden dimension $d$, the sequence dimension $S$, or head-by-head ($H$).
- **Decision**: Shard head-by-head across query and key-value heads.
- **Rationale**: Head-wise sharding ensures that the $Q K^T$ matrix multiplication and softmax require **zero inter-worker communication**. Each head is computed purely locally.
- **Rejected Alternatives**:
  - _Hidden-dimension slicing_: Slicing $d_k$ breaks dot-product locality, requiring an All-Reduce inside the softmax.

### ADR-185-002: Grouped-Query Attention (GQA) Head Group Alignment

- **Context**: In GQA models (such as LLaMA-3), $H_Q > H_{KV}$ where $G = H_Q / H_{KV}$ query heads share a single $KV$ head pair.
- **Decision**: Enforce that the number of tensor parallel workers $P$ divides both $H_Q$ and $H_{KV}$ (i.e. $H_{KV} \bmod P = 0$). Each worker holds $H_{KV} / P$ key-value heads and $(H_{KV} / P) \times G$ query heads.
- **Rationale**: Eliminates the need to communicate or replicate $KV$ heads across different workers.
- **Rejected Alternatives**:
  - _Replicating KV heads across workers when $P > H\_{KV}$_: Increases memory consumption and breaks strict tensor parallelism symmetry.

### ADR-185-003: Ring Attention for Infinite Sequence Contexts

- **Context**: When sequence length $S$ exceeds single-worker GPU SRAM/VRAM, attention matrices cause out-of-memory errors.
- **Decision**: Implement Ring Attention where Key-Value blocks are shifted in a circular topology while Query blocks remain stationary.
- **Rationale**: Overlaps computation of block $i$ with P2P transfer of block $i+1$, achieving linear scaling in context length with memory bounded to $O(S / P)$.
- **Rejected Alternatives**:
  - _Full sequence gathering before attention_: Defeats the memory benefits of sequence parallelism.
