# SPEC-318: FlashAttention-Style Online Softmax Tiling & Block-Paged Attention Kernel

**Status**: `APPROVED`
**Change Reference**: `CHANGE-180`
**Intake Reference**: `INTAKE-180`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Requirements Overview (IEEE 830 / ISO 29148)

### Functional Requirements (EARS Syntax)

#### FR-1: Tile Partitioning and Block Memory Allocation

- **Pattern**: Ubiquitous
- **Requirement**: The system shall partition input tensors $Q \in \mathbb{R}^{N_q \times d}$ into row blocks of size $B_r \times d$ and $K, V \in \mathbb{R}^{N_k \times d}$ into column blocks of size $B_c \times d$ where $B_r, B_c \in \{16, 32, 64\}$ such that working buffer memory never exceeds $O(B_r \cdot d + B_c \cdot d)$.

#### FR-2: Scaled Dot-Product Tile Matrix Multiplication

- **Pattern**: Event-Driven
- **Requirement**: When processing a tile pair $(Q_i, K_j)$, the system shall compute intermediate attention scores $S_{ij} = Q_i K_j^T / \sqrt{d}$, optionally applying causal masking by setting $S_{ij}[r, c] = -\infty$ whenever the global token index of query exceeds key in autoregressive mode.

#### FR-3: Numerical Stability via Running Online Softmax

- **Pattern**: State-Driven
- **Requirement**: While iterating over column blocks $j \in \{0, \dots, T_c - 1\}$, the system shall update the per-row running maximum $m_i^{(j)} = \max(m_i^{(j-1)}, \max_k S_{ik}^{(j)})$ and rescaled running sum $l_i^{(j)} = \exp(m_i^{(j-1)} - m_i^{(j)}) \cdot l_i^{(j-1)} + \sum_k \exp(S_{ik}^{(j)} - m_i^{(j)})$ without suffering floating-point underflow or overflow.

#### FR-4: Online Value Accumulation and Normalization

- **Pattern**: Event-Driven
- **Requirement**: When updating output tile accumulators $O_i$, the system shall rescale prior state by $\exp(m_i^{(j-1)} - m_i^{(j)})$ and add $\exp(S_{ij} - m_i^{(j)}) V_j$, finalizing the row block output as $O_i^{(\text{final})} = O_i / l_i$ with exact mathematical equivalence to standard softmax attention.

#### FR-5: Block Causal Mask Pruning Fast-Path

- **Pattern**: Event-Driven
- **Requirement**: When causal mode is enabled and a key/value column block $j$ satisfies $j \cdot B_c > (i + 1) \cdot B_r - 1$, the system shall skip computation of the tile pair $(i, j)$ entirely without evaluating inner dot products.

#### FR-6: Verification and Structural Invariant Audit

- **Pattern**: Ubiquitous
- **Requirement**: The system shall verify mathematical equivalence against naive quadratic attention ($\max |O_{\text{flash}} - O_{\text{naive}}| < 10^{-5}$), certify running normalizers strictly positive ($l_i > 0$), and generate a signed SHA-256 cryptographic receipt.

---

## 2. BDD Acceptance Criteria

```gherkin
SCENARIO: BDD-1683 Tile Partitioning & Workspace Memory Bounds
  GIVEN a sequence of length N_q = 64, N_k = 64 with head dimension d = 16
  WHEN partitioning into tiles of B_r = 16 and B_c = 16
  THEN exactly 4 query row blocks and 4 key/value column blocks are formed
  AND temporary workspace memory allocations remain strictly bounded by O(B_r * d + B_c * d)

SCENARIO: BDD-1684 Scaled Dot-Product Tile Matrix Multiplication & Causal Masking
  GIVEN query tile Q_i and key tile K_j with d = 16
  WHEN computing the scaled dot-product tile with causal masking enabled
  THEN upper triangular elements past the diagonal evaluate to -Infinity
  AND valid elements are scaled deterministically by 1 / sqrt(16) = 0.25

SCENARIO: BDD-1685 Online Softmax Running Maximum & Sum Rescaling
  GIVEN initial row running stats m_0 = -Infinity and l_0 = 0
  WHEN sequential column blocks j = 0 and j = 1 are processed
  THEN running maximum m_i updates monotonically: m_i^(1) >= m_i^(0)
  AND normalizer l_i strictly satisfies l_i^(1) == exp(m_0 - m_1)*l_0 + sum(exp(S_1 - m_1)) > 0

SCENARIO: BDD-1686 Full Attention Forward Pass & Mathematical Equivalence
  GIVEN random query, key, and value tensors Q, K, V
  WHEN executing the FlashAttention tiled online forward pass and naive O(N^2) attention
  THEN maximum absolute difference between both output matrices is strictly less than 1e-5
  AND relative error is bounded within IEEE 754 float32 precision limits

SCENARIO: BDD-1687 Causal Block Pruning Acceleration Fast-Path
  GIVEN causal attention on sequence length N = 64 with B_r = 16, B_c = 16
  WHEN executing tiled attention with block-skipping enabled
  THEN strictly 6 out of 16 tile pairs are pruned from evaluation
  AND total dot-product operations are reduced by at least 37.5%

SCENARIO: BDD-1688 Structural Invariant Audit & Cryptographic SHA-256 Receipt
  GIVEN an executed FlashAttention session with multiple tiles
  WHEN executing toolchain:flash:audit
  THEN verification status is VERIFIED with zero numerical anomalies
  AND a deterministic SHA-256 cryptographic receipt is recorded in docs/evidence/
```
