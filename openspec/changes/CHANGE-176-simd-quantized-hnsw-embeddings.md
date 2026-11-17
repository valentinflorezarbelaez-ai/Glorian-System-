# CHANGE-176 — SIMD Quantized Vector Embedding Engine (i8x16 / f32x4) for Sub-Millisecond HNSW Search

- **Specification**: `SPEC-314`
- **Milestone**: `v78.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `PROPOSED`

---

## 1. Intent

Implement a high-throughput, memory-compact vector embedding engine utilizing 8-bit asymmetric scalar quantization (SQ8), 16-byte aligned SIMD memory layouts, and accelerated integer dot-product kernels. Integrate the quantized distance metric into the Hierarchical Navigable Small World (HNSW) graph index to achieve $4\times$ memory reduction and sub-millisecond nearest neighbor query turnaround without heap allocations.

---

## 2. Delta Specification

1. **Quantization & Memory Layout**:
   - Asymmetric 8-bit scalar quantization mapping continuous $\mathbb{R}^D$ floats to integer range $[-128, 127]$:
     $$\tilde{v}_i = \text{round}\left( \frac{v_i - \min(v)}{\max(v) - \min(v)} \times 255 \right) - 128$$
   - Vector scale factor $\alpha = \frac{\max(v) - \min(v)}{255}$ and offset $z = \min(v)$ stored per vector.
   - 16-byte aligned `Int8Array` chunk storage for zero-copy SIMD vectorized loads (`i8x16`).
2. **SIMD Dot Product & Cosine Distance**:
   - Accumulator evaluated in 32-bit integer arithmetic without intermediate float conversions.
   - Dequantized dot product expansion:
     $$\langle u, v \rangle \approx \alpha_u \alpha_v \sum_{i} \tilde{u}_i \tilde{v}_i + \alpha_u z_v \sum_i \tilde{u}_i + \alpha_v z_u \sum_i \tilde{v}_i + D \cdot z_u z_v$$
   - Cosine distance computed directly from precomputed quantized norms.
3. **Quantized HNSW Graph Traversal**:
   - HNSW layers with quantized vector payloads.
   - Beam search evaluating distance against quantized candidates with sub-millisecond latency.
4. **Core API**:
   - `quantizeVector(rawVector)` -> `{ quantized: Int8Array, scale: number, offset: number, sum: number, norm: number }`
   - `simdDotProduct(vecA, vecB)` -> `number`
   - `simdCosineDistance(vecA, vecB)` -> `number`
   - `createQuantizedHnswIndex(dimensions, options)`
   - `insertQuantizedVector(index, id, vector)`
   - `searchQuantizedKnn(index, queryVector, k)`
   - `auditQuantizedInvariants(index)`
5. **CLI Dispatcher**:
   - `toolchain:quant:quantize`
   - `toolchain:quant:dot`
   - `toolchain:quant:cosine`
   - `toolchain:quant:hnsw`
   - `toolchain:quant:audit`
