# Architecture Plan & Decision Records: FlashAttention-Style Online Softmax Tiling

**Identifier**: `PLAN-180`
**Target Specification**: `SPEC-318`
**Target Change**: `CHANGE-180`
**Status**: `APPROVED`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Architectural Overview

This plan implements the FlashAttention algorithm (Dao et al., 2022) with online softmax computation (Milakov & Gimelshein, 2018) in pure, zero-dependency TypeScript. Instead of computing the full attention matrix $A = \text{Softmax}(Q K^T / \sqrt{d})$ of size $N \times N$, we split $Q$ into blocks $Q_i$ ($B_r \times d$) and $K, V$ into blocks $K_j, V_j$ ($B_c \times d$).

Outer loop iterates over column blocks $j \in [0, T_c - 1]$, loading $K_j, V_j$ into fast memory.
Inner loop iterates over row blocks $i \in [0, T_r - 1]$, computing:

1. $S_{ij} = Q_i K_j^T / \sqrt{d}$
2. Local maximum $\tilde{m}_{ij} = \text{rowmax}(S_{ij})$
3. Local unnormalized probabilities $\tilde{P}_{ij} = \exp(S_{ij} - \tilde{m}_{ij})$
4. Local sum $\tilde{l}_{ij} = \text{rowsum}(\tilde{P}_{ij})$
5. New running maximum $m_i^{\text{new}} = \max(m_i, \tilde{m}_{ij})$
6. Rescaling factor $\alpha = \exp(m_i - m_i^{\text{new}})$, $\beta = \exp(\tilde{m}_{ij} - m_i^{\text{new}})$
7. Updated running sum $l_i^{\text{new}} = \alpha \cdot l_i + \beta \cdot \tilde{l}_{ij}$
8. Updated output accumulator $O_i^{\text{new}} = \alpha \cdot O_i + \beta \cdot \tilde{P}_{ij} V_j$
9. Post-loop normalization: $O_i^{\text{final}} = O_i / l_i$

---

## 2. Architecture Decision Records (ADRs)

### ADR-180-001: Online Softmax Rescaling vs Two-Pass Materialized Softmax

- **Context**: Traditional softmax requires finding the global maximum across all $N_k$ tokens before evaluating exponents, followed by computing the total sum before normalizing. This necessitates materializing all $N_q \times N_k$ elements simultaneously.
- **Decision**: Adopt the online running softmax update with exponent difference compensation ($\alpha = \exp(m_{\text{old}} - m_{\text{new}})$).
- **Rejected Alternatives**:
  - _Full Materialization ($O(N^2)$)_: Rejected due to catastrophic memory growth ($N=128\text{k} \implies 128\text{k} \times 128\text{k} \times 4\text{B} \approx 64\,\text{GB}$ per head).
  - _Approximation via Sparse Attention_: Rejected because sparse attention alters the mathematical output and degrades downstream model quality.
- **Consequences**: Exact mathematical equivalence with $O(B_r \cdot d + B_c \cdot d)$ working memory.

### ADR-180-002: Tiling Granularity ($B_r, B_c = 16$) Aligned with Paged KV-Cache

- **Context**: `SPEC-317` established a physical block size of $B = 16$ tokens for paged KV-cache allocation.
- **Decision**: Set default block size $B_r = 16$ and $B_c = 16$. This allows direct 1-to-1 mapping between FlashAttention column tiles and physical KV-cache page blocks without re-chunking.
- **Rejected Alternatives**:
  - _Arbitrary dynamic tile sizes_: Rejected due to impedance mismatch with page tables and increased branch overhead.
  - _Large tiles ($B=128$)_: Rejected because $128 \times 128$ float buffers exceed standard L1 cache line residency thresholds.
- **Consequences**: Direct zero-copy traversal over paged KV-cache block tables.

### ADR-180-003: Block-Level Causal Pruning vs Element-Level Masking in SRAM

- **Context**: In causal/autoregressive attention, tokens can only attend to previous tokens ($k \le q$).
- **Decision**: Implement two-tier pruning:
  1. _Block-level skip_: If an entire tile is strictly in the future ($j \cdot B_c > (i + 1) \cdot B_r - 1$), the tile computation is completely bypassed ($O(1)$ check).
  2. _Intra-block mask_: For boundary tiles where $j \cdot B_c \le (i + 1) \cdot B_r - 1$ and $(j + 1) \cdot B_c > i \cdot B_r$, apply $-\infty$ only to strictly future elements.
- **Rejected Alternatives**:
  - _Unconditional computation with post-masking_: Evaluates $N^2$ dot products and discards 50%, wasting half of compute.
- **Consequences**: Halves attention FLOPs on long generation sequences.
