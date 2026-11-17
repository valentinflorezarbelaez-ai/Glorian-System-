# PLAN-193: StreamingLLM, Attention Sinks & Infinite-Context Window Memory Compression Engine

**Specification Ref**: `SPEC-331` / `CHANGE-193`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Created**: 2026-11-17

---

## 1. Architectural Strategy & Design

The StreamingLLM engine decouples memory management in the autoregressive decode phase into two distinct regions:

1. **Permanent Attention Sink Region ($K\_{\text{sink}}$)**: Holds the first $K_{\text{sink}}$ tokens (typically 4). These tokens receive high attention scores across all heads due to softmax normalization requirements and must never be evicted.
2. **Rolling Window Ring Buffer ($W\_{\text{local}}$)**: Holds the $W_{\text{local}}$ most recent tokens using circular pointer arithmetic ($O(1)$ evict and append).
3. **RoPE Re-Indexing Controller**: Re-aligns rotary embedding position indices to keep the relative distance between recent tokens identical to a standard window without intermediate gap artifacts.
4. **Softmax Dispersion Monitor**: Validates that attention mass remains bounded and free of numerical divergence compared to naive sliding window attention.

---

## 2. Architecture Decision Records (ADRs)

### ADR-193-001: Attention Sink Dual-Region Cache vs Naive Sliding Window

- **Context**: Evicting older tokens from the KV cache in long-context streaming causes catastrophic perplexity explosion due to the loss of initial softmax normalization sinks.
- **Decision**: Reserve a dedicated, unevictable sink region of $K_{\text{sink}} = 4$ tokens, combining it with an $O(1)$ circular sliding window $W_{\text{local}}$.
- **Alternatives Rejected**:
  1. _Naive Sliding Window_: Suffers from catastrophic perplexity failure once token 0 is evicted.
  2. _Periodic Re-Computation_: Stalls inference every $W$ steps with an expensive $O(W^2)$ full prefill.
- **Consequences**: Enables infinite streaming generation with strictly bounded memory $O(K_{\text{sink}} + W_{\text{local}})$ and stable perplexity.

### ADR-193-002: Dynamic Positional RoPE Shifting vs Static Global Positions

- **Context**: When tokens between $K_{\text{sink}}$ and $T - W_{\text{local}}$ are dropped, standard global position IDs create a large gap between sink tokens and window tokens, pushing keys into unseen RoPE frequency regimes.
- **Decision**: Shift position IDs dynamically: assign positions $0 \dots K_{\text{sink}}-1$ to sinks, and contiguous positions $K_{\text{sink}} \dots K_{\text{sink}} + W_{\text{local}} - 1$ to the active local window.
- **Alternatives Rejected**:
  1. _Global absolute position indices_: Causes extreme relative distance out-of-distribution errors in rotary embeddings.
  2. _Re-training / Fine-tuning with position interpolations_: Requires retraining the underlying model.
- **Consequences**: Zero fine-tuning required; attention distance semantics within the local window remain perfectly natural.

### ADR-193-003: Circular Buffer Ring Array vs Heap Dynamic Arrays

- **Context**: Array shifts (`splice(0, 1)`) in JavaScript/TypeScript re-index all subsequent elements, incurring $O(W)$ copy overhead per generated token.
- **Decision**: Implement circular buffer ring arrays using modular pointer arithmetic (`(head + offset) % W_local`) for $O(1)$ appends and zero heap reallocation.
- **Alternatives Rejected**:
  1. _Array.splice / shift_: Garbage collection pressure and $O(W)$ memory copying on every single generated token.
  2. _Linked list of KV blocks_: Pointer indirection and cache line fragmentation.
- **Consequences**: High-throughput $O(1)$ ingestion and eviction with zero GC thrashing.
