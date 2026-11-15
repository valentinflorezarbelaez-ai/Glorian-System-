# Architecture Plan: PLAN-145 — Sharded Vector Indexing & SIMD-Style Quantization Governor

- **Change Reference**: `CHANGE-145`
- **Spec Reference**: `SPEC-283`
- **Intake Reference**: `INTAKE-145`
- **Target**: `src/core/eosVectorQuantizationGovernor.ts`
- **Date**: 2026-11-15

---

## 1. Architectural Strategy

### Scalar Quantization (SQ8) Formulation

For a vector $\vec{x} \in \mathbb{R}^D$:
$$\min_v = \min_i(x_i), \quad \max_v = \max_i(x_i)$$
$$\text{scale} = \frac{\max_v - \min_v}{255}, \quad \text{offset} = \min_v$$
$$q_i = \text{round}\left(\frac{x_i - \text{offset}}{\text{scale}}\right) \in [0, 255]$$
Dequantization:
$$\hat{x}_i = q_i \times \text{scale} + \text{offset}$$

### High-Throughput Inner Product Loop Unrolling

To maximize CPU pipeline saturation and vectorization within JavaScript engines (V8 TurboFan), inner products unroll by chunks of 4:

```typescript
let dot = 0;
let i = 0;
const len = a.length;
const limit = len - 3;
while (i < limit) {
  dot += a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3];
  i += 4;
}
while (i < len) {
  dot += a[i] * b[i];
  i++;
}
```

### Partitioned Sharding Architecture

Vectors are indexed into shards keyed by tenant, region, or clustering label, preventing full table scans when queries provide a partition constraint.

### Modular CLI Architecture

Create `bin/commands/cliVectorIndex.mjs` and delegate cleanly from `bin/commands/cliDevOps.mjs` with minimal line overhead.
