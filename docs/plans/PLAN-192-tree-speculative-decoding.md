# PLAN-192: Tree-Structured Speculative Decoding, Multi-Candidate Rejection Sampling & Dynamic Draft-Target Verification Engine

**Specification Ref**: `SPEC-330` / `CHANGE-192`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Created**: 2026-11-17

---

## 1. Architectural Strategy & Design

Tree-structured speculative decoding transforms the sequential token-by-token bottleneck into parallel candidate verification. The engine consists of 4 decoupled core components:

1. **Tree Topology Builder**: Synthesizes candidate beams into a directed tree node DAG, assigning sequential IDs, depths, and parent pointers.
2. **2D Tree Attention Mask Synthesizer**: Generates binary lower-triangular non-standard masks ensuring that every node attends only to its ancestral lineage.
3. **Modified Rejection Sampler**: Evaluates target logits against draft probabilities using Leviathan / Chen's modified rejection sampling with normalized positive residual distribution fallback.
4. **Adaptive Tree Topology Governor**: Modulates tree depth and width according to moving-average acceptance rates ($\alpha$), computing theoretical and empirical speedups.

---

## 2. Architecture Decision Records (ADRs)

### ADR-192-001: 2D Directed Tree Attention Mask vs Multiple Linear Forward Passes

- **Context**: In speculative decoding with multiple candidate branches, naive implementations execute separate forward passes for each candidate chain, duplicating target compute.
- **Decision**: Synthesize a single 2D tree attention mask $M \in \{0, 1\}^{K \times K}$ where $M_{i, j} = 1 \iff j \in \text{Ancestors}(i) \cup \{i\}$. Flatten all tree nodes into one contiguous batch and execute a **single** target forward pass.
- **Alternatives Rejected**:
  1. _Sequential linear candidate passes_: High target memory-bandwidth overhead; eliminates speculative speedup advantages.
  2. _Independent parallel batching of chains_: Redundantly evaluates common prefixes of different branches, wasting FLOPs.
- **Consequences**: Enables simultaneous evaluation of all $K$ candidate nodes in a single forward pass with zero redundant prefix compute.

### ADR-192-002: Leviathan Rejection Sampling vs Pure Greedy / Argmax Verification

- **Context**: Greedy verification (accept if $x_i = \arg\max p(x)$) causes deterministic mode collapse and alters the temperature/sampling distribution of stochastic decoding.
- **Decision**: Implement modified rejection sampling: accept $x_i$ with probability $\min\left(1, \frac{p(x_i)}{q(x_i)}\right)$; upon rejection, sample from normalized residual $p'(x) = \frac{(p(x) - q(x))^+}{\sum_y (p(y) - q(y))^+}$.
- **Alternatives Rejected**:
  1. _Greedy thresholding_: Alters generation distribution; unacceptable for temperature $> 0$.
  2. _Re-sampling from pure $p(x)$ on rejection_: Violates exact distribution invariance ($D_{KL} > 0$).
- **Consequences**: Mathematically proves $D_{KL}(P_{\text{spec}} \parallel P_{\text{target}}) = 0.0$, guaranteeing bit-accurate distributional equivalence with standard sampling.

### ADR-192-003: Dynamic Tree Modulation vs Static Fixed Tree Shape

- **Context**: Fixed tree structures (e.g. Medusa-4 with fixed branches) incur negative speedups when the draft model poorly aligns with the prompt domain (low $\alpha$).
- **Decision**: Implement an adaptive controller that tracks the exponential moving average of $\alpha$. When $\alpha \ge 0.75$, increase tree depth; when $\alpha < 0.40$, contract to a minimal linear chain.
- **Alternatives Rejected**:
  1. _Static tree_: Heavy penalty in hard/out-of-distribution reasoning tasks.
  2. _Per-token brute-force search_: Excessive CPU orchestration latency.
- **Consequences**: Maximizes net throughput across both high-predictability code/summarization tasks and high-entropy creative tasks.
