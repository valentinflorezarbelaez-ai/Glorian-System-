# PLAN-176 — SIMD Quantized Vector Embedding Engine (i8x16 / f32x4) for Sub-Millisecond HNSW Search

- **Specification**: `SPEC-314`
- **Milestone**: `v78.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`

---

## 1. Architectural Design & System Components

### 1.1 Quantization Mathematics & Memory Layout

- Asymmetric 8-bit scalar quantization mapping continuous $\mathbb{R}^D$ to signed `Int8Array` $[-128, 127]$.
- Memory padding: Vector dimension padded to next multiple of 16 for uninterrupted 16-byte SIMD block loads (`i8x16`).
- Vector metadata:
  - `scale` ($\alpha$): Float32
  - `offset` ($z$): Float32
  - `sum`: Int32 accumulator of raw quantized values $\sum \tilde{v}_i$
  - `norm`: Float32 precomputed $\|\mathbf{v}\|_2$ Euclidean norm for $O(1)$ cosine distance normalization.

### 1.2 SIMD Dot Product Kernel

- Integer block accumulation: 16 bytes per chunk evaluated with unrolled scalar operations or `DataView`/typed array access.
- Reconstruction formula:
  $$\langle u, v \rangle \approx \alpha_u \alpha_v \sum_{i} \tilde{u}_i \tilde{v}_i + \alpha_u z_v \text{sum}_u + \alpha_v z_u \text{sum}_v + D \cdot z_u z_v$$
- Zero heap allocation: computation returns a primitive `number` without intermediate object creation.

### 1.3 Quantized HNSW Multi-Layer Graph

- Graph structure:
  - `layers`: Array of adjacency maps `Map<string, string[]>` per level $l \in [0, L_{\max}]$.
  - `nodes`: Map of node ID to quantized vector metadata.
  - Geometric level generation: $l = \lfloor -\ln(\text{uniform}()) \cdot m_L \rfloor$.
  - Greedy routing down from $L_{\max}$ to 1.
  - Heuristic beam search at layer 0 keeping up to `efConstruction` candidates.

---

## 2. Inviolable Quality Gates

1. **Zero External Runtime Dependencies**: Standard Node.js only.
2. **File Size Budgets**: $\le 800$ lines with $\ge 12$ lines headroom per file (`SPEC-250`).
3. **Formal Verification (TLA+)**: TLA+ Model 58 checked with TLC.
4. **CLI Parity**: 100% catalog parity, pure `--json` outputs with `return true`.
5. **Signed Receipt**: `docs/evidence/SIMD_QUANTIZED_HNSW_RECEIPT.json`.
