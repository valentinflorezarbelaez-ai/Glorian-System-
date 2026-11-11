# PLAN-093: Layer-0 Reverse-Mode Automatic Differentiation & Multidimensional Tensor Core (SPEC-208)

- **Date**: 2026-11-10
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: APPROVED

---

## 1. Technical Strategy

1. **Tensor Architecture**:
   - `shape: readonly number[]` (e.g. `[2, 3]`), `strides: readonly number[]` computed contiguously row-major.
   - Storage: flat `Float64Array(totalElements)`.
   - Gradient storage: optional `Float64Array(totalElements)` allocated when `requiresGrad: true`.
   - Index calculation: offset $= \sum_i \text{index}_i \cdot \text{strides}_i$.
2. **Operations Supported**:
   - `add(a, b)`: $y = a + b \implies \bar{a} \mathrel{+}= \bar{y}, \bar{b} \mathrel{+}= \bar{y}$.
   - `sub(a, b)`: $y = a - b \implies \bar{a} \mathrel{+}= \bar{y}, \bar{b} \mathrel{+}= -\bar{y}$.
   - `mul(a, b)`: $y = a \odot b \implies \bar{a} \mathrel{+}= \bar{y} \odot b, \bar{b} \mathrel{+}= \bar{y} \odot a$.
   - `matmul(a, b)`: for $A \in \mathbb{R}^{M \times K}, B \in \mathbb{R}^{K \times N}$, $Y = AB \implies \bar{A} \mathrel{+}= \bar{Y} B^T, \bar{B} \mathrel{+}= A^T \bar{Y}$.
   - `relu(x)`: $y = \max(0, x) \implies \bar{x} \mathrel{+}= \bar{y} \cdot \mathbf{1}_{x > 0}$.
   - `sigmoid(x)`: $y = \sigma(x) \implies \bar{x} \mathrel{+}= \bar{y} \cdot y(1 - y)$.
   - `tanh(x)`: $y = \tanh(x) \implies \bar{x} \mathrel{+}= \bar{y} \cdot (1 - y^2)$.
   - `sum(x)`: scalar reduction $y = \sum x_i \implies \bar{x}_i \mathrel{+}= \bar{y}$.
   - `mean(x)`: $y = \frac{1}{N} \sum x_i \implies \bar{x}_i \mathrel{+}= \frac{\bar{y}}{N}$.
   - `pow(x, p)`: $y = x^p \implies \bar{x} \mathrel{+}= \bar{y} \cdot p \cdot x^{p-1}$.
   - `mseLoss(pred, target)`: $\mathcal{L} = \text{mean}((pred - target)^2)$.
3. **Reverse-Mode Backward Pass**:
   - Build topological sort of computational DAG starting from loss node.
   - Set loss adjoint to 1.0 (or scalar value).
   - Traverse nodes in reverse topological order, calling each node's `backwardFn(upstreamGrad)`.
   - Accumulate gradients onto leaf tensors.
4. **Numerical Gradient Checking**:
   - For each parameter element $j$, evaluate $\frac{\mathcal{L}(\theta_j + \epsilon) - \mathcal{L}(\theta_j - \epsilon)}{2\epsilon}$.
   - Compare with $\bar{\theta}_j$ and compute maximum relative error.
5. **Optimization**:
   - SGD step: $\theta \leftarrow \theta - \eta \cdot \bar{\theta}$.
   - `zeroGrad()` clears all accumulated gradients.
6. **DbC & Receipts**:
   - Strict shape checks, pure SHA-256 state receipts.
