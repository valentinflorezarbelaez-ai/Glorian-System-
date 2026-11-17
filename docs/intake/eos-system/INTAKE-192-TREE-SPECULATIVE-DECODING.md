# INTAKE-192: Tree-Structured Speculative Decoding, Multi-Candidate Rejection Sampling & Dynamic Draft-Target Verification Engine

**Date**: 2026-11-17  
**Author**: Valentin Florez Arbelaez  
**Status**: APPROVED  
**Target System**: Glorian System / EOS System (`eos-system`)  
**Domain**: Neural Inference Optimization, Speculative Decoding, Tree Attention, Rejection Sampling

---

## 1. Context & Motivation

Auto-regressive large language model (LLM) inference is fundamentally bounded by memory bandwidth during the token generation (decode) phase. Generating $N$ sequential tokens requires $N$ separate forward passes across the GPU/accelerator high-bandwidth memory (HBM), yielding an arithmetic intensity of $\approx 1$ FLOP/byte and leaving compute units drastically underutilized.

Speculative decoding overcomes this memory-bandwidth bottleneck by employing a lightweight draft model (or parallel multi-token draft heads, e.g. Medusa) to propose candidate tokens in parallel, which are subsequently validated by the target LLM in a single forward pass. However, linear chain speculative decoding suffers from early branch divergence: a single rejected token invalidates all subsequent proposed tokens in the chain.

Tree-structured speculative decoding generalizes linear speculative chains to an arbitrary directed tree of candidate hypotheses. By constructing a 2D non-causal tree attention mask, the target model evaluates an entire tree of $K$ candidate tokens simultaneously in one forward execution. A modified rejection sampling algorithm guarantees that the accepted token sequence is sampled exactly from the target model's probability distribution ($D_{KL}(P_{\text{spec}} \parallel P_{\text{target}}) = 0$), preserving 100% mathematical fidelity while achieving a $2.5\times$ to $3.5\times$ speedup in decoding latency.

---

## 2. Technical Objectives

1. **Tree Hypothesis Topology & 2D Tree Attention Mask**:
   - Construct directed tree structures where nodes represent candidate token IDs and edges represent sequential continuations.
   - Flatten tree nodes into a 1D sequential tensor with 1D positional encodings matching tree depth.
   - Synthesize a binary 2D causal tree attention mask $M \in \{0, 1\}^{K \times K}$ where $M_{i, j} = 1$ if and only if node $j$ is an ancestor of node $i$ (or $i = j$).

2. **Modified Rejection Sampling with Zero Distributional Shift**:
   - Implement Leviathan et al. / Chen et al. modified rejection sampling for each candidate token $x_i$ given target probability $p(x_i)$ and draft probability $q(x_i)$.
   - Accept with probability $\min\left(1, \frac{p(x_i)}{q(x_i)}\right)$.
   - Upon rejection, draw a recovery token from the normalized positive residual distribution:
     $$p'(x) = \frac{\max(0, p(x) - q(x))}{\sum_{y} \max(0, p(y) - q(y))}$$
   - Guarantee zero Kullback-Leibler divergence ($D_{KL} = 0.0$) against native target sampling.

3. **Multi-Branch Dynamic Path Acceptance**:
   - Traverse the candidate tree along accepted paths, finding the longest accepted sequence of tokens in the verification step.
   - Emit the accepted prefix plus exactly one newly sampled correction token, ensuring strictly $\ge 1$ token is generated per target step.

4. **Dynamic Draft Length & Tree Topology Modulation**:
   - Monitor historical acceptance rate $\alpha = \frac{\text{accepted tokens}}{\text{speculated tokens}}$.
   - Adaptively modulate tree depth and branching factor: expand tree when $\alpha \ge 0.75$, contract when $\alpha < 0.40$ to avoid wasteful target verification overhead.

5. **Formal Verification via TLA+ (Model 74)**:
   - Formally prove with Leslie Lamport's TLC model checker:
     - `TypeOK`: Well-typed tokens and probability vectors.
     - `TreeMaskAncestry`: Attention mask strictly enforces that tokens can only attend to true ancestors.
     - `GuaranteedProgress`: Every verification step produces $\ge 1$ verified token.
     - `DistributionalFidelity`: Rejection recovery distribution sums to 1.0.

6. **Full Parity CLI & Zero-Dependency Runtime**:
   - Layer-0 TypeScript conforming to `SPEC-250` ($\le 800$ lines, $\ge 12$ lines headroom).
   - 5 CLI commands under `toolchain:specdec:` registering 100% parity (`573 \to 578` commands).
   - BDD test suite BDD-1755..1760 passing with SHA-256 evidence receipt.
