# PLAN-183: Megatron-LM Style Tensor Parallelism & Sharded Linear Layers

---

## 1. Architectural Strategy

The Megatron-LM tensor parallel paradigm targets the core computation bottleneck of Transformer architectures: matrix multiplications in Multi-Layer Perceptrons (MLP) and Multi-Head Attention (MHA).
By pairing **Column-Parallel Linear Layers** ($X W_1$) with **Row-Parallel Linear Layers** ($Z W_2$), the intermediate tensor $Z = \sigma(X W_1)$ remains sharded along the hidden dimension, completely bypassing communication in the hidden layer. Only a single `All-Reduce` collective synchronization is needed at the end of the 2-layer sequence.

---

## 2. Architectural Decision Records (ADRs)

### ADR-183-001: Column-Parallel followed by Row-Parallel Ordering

- **Status**: ACCEPTED
- **Context**: In a 2-layer linear sequence $X \to Y = X W_1 \to Z = \sigma(Y) \to O = Z W_2$, we need to decide which layer is split column-wise and which row-wise.
- **Decision**: Split $W_1$ column-wise ($d_{\text{in}} \times \frac{d_{\text{hidden}}}{P}$) and $W_2$ row-wise ($\frac{d_{\text{hidden}}}{P} \times d_{\text{out}}$).
- **Rationale**:
  - $Y^{(p)} = X W_1^{(p)}$ requires no communication.
  - $\sigma(Y^{(p)})$ is an element-wise operator that operates locally without cross-worker communication.
  - $O^{(p)} = Z^{(p)} W_2^{(p)}$ operates locally without communication.
  - The final sum $O = \sum_{p=0}^{P-1} O^{(p)}$ requires only **one All-Reduce** at the very end.
- **Rejected Alternative**: Row-Parallel first followed by Column-Parallel requires an All-Reduce immediately before the activation function, requiring two All-Reduce calls instead of one.

### ADR-183-002: Exact Polynomial Approximation for GeLU Activation

- **Status**: ACCEPTED
- **Context**: Standard GeLU is defined as $\text{GeLU}(x) = x \cdot \Phi(x) = x \cdot \frac{1}{2} [1 + \text{erf}(x / \sqrt{2})]$.
- **Decision**: Implement the standard tanh approximation:
  $$\text{GeLU}(x) \approx 0.5 \cdot x \cdot \left(1 + \tanh\left(\sqrt{\frac{2}{\pi}} \cdot (x + 0.044715 \cdot x^3)\right)\right)$$
  and SiLU (Swish-1):
  $$\text{SiLU}(x) = \frac{x}{1 + e^{-x}}$$
- **Rationale**: Deterministic, high numerical stability, zero dependencies, matching PyTorch/Megatron standard implementations within $10^{-6}$.

### ADR-183-003: Sharded Vocabulary Cross-Entropy via Distributed Log-Sum-Exp

- **Status**: ACCEPTED
- **Context**: Computing softmax over large vocabulary $V$ on a single worker incurs $O(B \cdot V)$ memory.
- **Decision**: Partition logits column-wise across $P$ workers ($V/P$ per worker). Synchronize only scalar maximums $m_b = \max_p m_b^{(p)}$ and sum of exponentials $S_b = \sum_p S_b^{(p)}$ using two lightweight scalar All-Reduce steps.
- **Rationale**: Bounded memory footprint per worker while generating exact cross-entropy loss without ever materializing the monolithic logit matrix.
