# INTAKE-183: Megatron-LM Style Tensor Parallelism (Column & Row Linear Sharding)

---

## 1. Problem Statement

When scaling large language model (LLM) architectures, feed-forward networks (MLP) and linear projections exceed the high-bandwidth memory (HBM/SRAM) capacity of a single GPU or worker node. Naive distributed architectures serialize matrix operations or require synchronization between every linear projection, creating severe network latency bottlenecks and memory fragmentation.

## 2. Theoretical Architecture (Megatron-LM Paradigm)

Following the pioneering architecture of Shoeybi et al. (Megatron-LM, NVIDIA), linear transformations in transformer layers can be strategically partitioned to minimize cross-worker communication:

1. **Column-Parallel Linear Layer**:
   - The weight matrix $W_1 \in \mathbb{R}^{d_{\text{in}} \times d_{\text{hidden}}}$ is partitioned column-wise across $P$ workers:
     $$W_1 = \begin{bmatrix} W_1^{(0)} & W_1^{(1)} & \dots & W_1^{(P-1)} \end{bmatrix}, \quad W_1^{(i)} \in \mathbb{R}^{d_{\text{in}} \times \frac{d_{\text{hidden}}}{P}}$$
   - Input $X \in \mathbb{R}^{B \times d_{\text{in}}}$ is replicated on each worker.
   - Each worker computes $Y^{(i)} = X W_1^{(i)}$ locally with **zero communication**.
   - Activation function $\sigma$ (e.g. GeLU or SiLU) is applied element-wise locally: $Z^{(i)} = \sigma(Y^{(i)})$.
2. **Row-Parallel Linear Layer**:
   - The second weight matrix $W_2 \in \mathbb{R}^{d_{\text{hidden}} \times d_{\text{out}}}$ is partitioned row-wise across $P$ workers:
     $$W_2 = \begin{bmatrix} W_2^{(0)} \\ W_2^{(1)} \\ \vdots \\ W_2^{(P-1)} \end{bmatrix}, \quad W_2^{(i)} \in \mathbb{R}^{\frac{d_{\text{hidden}}}{P} \times d_{\text{out}}}$$
   - Each worker computes partial output $O^{(i)} = Z^{(i)} W_2^{(i)}$ locally with **zero communication**.
   - Total output is $O = \sum_{i=0}^{P-1} O^{(i)}$.
3. **Single Collective Synchronization Point**:
   - Instead of synchronizing after both layers, an `All-Reduce` operation is performed **only once** on the sum $\sum_{i=0}^{P-1} O^{(i)}$ at the end of the MLP block, seamlessly interfacing with the Ring All-Reduce kernel (`SPEC-320`).
4. **Vocabulary Parallelism (Cross-Entropy Sharding)**:
   - For classification/language modeling heads, output logits over vocabulary $V$ are partitioned column-wise, computing local maxima and cross-entropy loss without gathering full vocabulary logits on any single worker.

## 3. Mathematical Invariants & Equivalence

- **Exact Numeric Parity**: For any input $X$ and weights $W_1, W_2$:
  $$\max |O_{\text{distributed}} - O_{\text{central}}| \le 10^{-6}$$
- **Communication Complexity**: Exactly 1 All-Reduce operation per 2-layer MLP block, transferring $2 \frac{P - 1}{P} \cdot (B \cdot d_{\text{out}}) \cdot 4\,\text{bytes}$ per worker.
- **Memory Footprint**: Weight storage per worker is reduced strictly to $\frac{1}{P} \cdot (|W_1| + |W_2|)$.
