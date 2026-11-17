# INTAKE-193: StreamingLLM, Attention Sinks & Infinite-Context Window Memory Compression Engine

**Date**: 2026-11-17  
**Author**: Valentin Florez Arbelaez  
**Status**: APPROVED  
**Target System**: Glorian System / EOS System (`eos-system`)  
**Domain**: Neural Inference Optimization, Streaming LLM, Attention Sinks, KV Cache Compression, RoPE Shift

---

## 1. Context & Motivation

Large Language Models (LLMs) deployed in streaming, multi-agent, or conversational environments require generating tokens over long horizons (tens of thousands to millions of tokens). Standard auto-regressive generation retains all past Key-Value (KV) states in memory, scaling as $O(T)$ in memory and $O(T^2)$ in attention computation. As sequence length $T$ grows, memory exhaustion (OOM) occurs inevitably.

Naive sliding-window attention (retaining only the most recent $W$ tokens) fails catastrophically: as soon as the initial sequence tokens are evicted from the KV cache, the model's perplexity explodes (often rising from $\approx 10$ to $> 10^3$).

Xiao et al. (StreamingLLM, 2023) discovered the root cause: **Attention Sinks**. Because softmax requires attention scores across keys to sum to 1.0 ($\sum_j \exp(S_{i, j}) / \sum_k \exp(S_{i, k}) = 1.0$), the model assigns massive attention weights (up to 40%-80%) to the very first few tokens ($K_{\text{sink}} \approx 4$) regardless of their semantic content. These initial tokens act as an invariant "attention sink" or numerical reservoir for softmax normalization. When these sink tokens are evicted in naive sliding window attention, the normalization collapses.

By retaining **only** the initial attention sink tokens ($K_{\text{sink}} \approx 4$) alongside the most recent sliding window of local tokens ($W_{\text{local}}$), an LLM can generate millions of tokens indefinitely with constant $O(K_{\text{sink}} + W_{\text{local}})$ memory footprint and stable perplexity without any fine-tuning or re-training.

Furthermore, when older tokens between the sink and sliding window are evicted, Rotary Position Embeddings (RoPE) relative positions must be mapped dynamically so that attention distance stays contiguous within the sliding window.

---

## 2. Technical Objectives

1. **Attention Sink Reservation & Dual-Region KV Cache Topology**:
   - Maintain a dedicated permanent sink region of size $K_{\text{sink}}$ (e.g. 4 tokens) initialized during prefill and immune to eviction.
   - Maintain a rolling circular buffer or ring of size $W_{\text{local}}$ (e.g. 1024 or 2048 tokens) for the recent local context.
   - Total active KV cache memory is strictly bounded by $O(K_{\text{sink}} + W_{\text{local}})$ for any sequence length $T \to \infty$.

2. **Perplexity Explosion Prevention Invariant**:
   - Prove empirically and formally that preserving $K_{\text{sink}} \ge 4$ bounds the cumulative attention score norm and keeps softmax variance stable, avoiding the divergence seen in naive windowing ($\Delta \text{PPL} \le 0.05$).

3. **Dynamic RoPE Positional Realignment**:
   - When intermediate tokens $[K_{\text{sink}}, T - W_{\text{local}}]$ are evicted, the position indices used for query and key rotary embeddings must be remapped contiguously to ensure distance consistency:
     $$\text{Pos}(i) = \begin{cases} i & \text{if } i < K_{\text{sink}} \\ K_{\text{sink}} + (i - (T - W_{\text{local}})) & \text{if } i \ge T - W_{\text{local}} \end{cases}$$

4. **Zero-Copy Eviction & In-Place Roll-Over**:
   - Implement ring-buffer pointer arithmetic for the sliding window so that evicting oldest local tokens requires $O(1)$ time complexity without array recopying or reallocation in heap memory.

5. **Formal Verification via TLA+ (Model 75)**:
   - Formally verify with Leslie Lamport's TLC:
     - `TypeOK`: Types of buffers and position mappings.
     - `SinkPreservation`: Sink tokens $\{0, \dots, K_{\text{sink}}-1\}$ are never evicted.
     - `MemoryBoundInvariant`: Active cached tokens $\le K_{\text{sink}} + W_{\text{local}}$.
     - `MonotonicPositionalOrdering`: RoPE positions remain monotonically non-decreasing.

6. **Full Parity CLI & Zero External Runtime Dependencies**:
   - Layer-0 TypeScript conforming to `SPEC-250` ($\le 800$ lines, $\ge 12$ lines headroom).
   - 5 CLI commands under `toolchain:streamllm:` registering 100% parity (`578 \to 583` commands).
   - BDD test suite BDD-1761..1766 passing with signed SHA-256 receipt.
