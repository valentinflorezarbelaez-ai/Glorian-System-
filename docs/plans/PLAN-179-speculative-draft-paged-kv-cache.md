# PLAN-179: Architecture Plan & Architectural Decision Records (ADRs) for Speculative Multi-Token Draft Verification & Paged KV-Cache Attention Engine

**Plan ID**: PLAN-179  
**Specification**: SPEC-317  
**Change Proposal**: CHANGE-179  
**Domain**: Deep Learning Inference Optimization, Virtual Memory Page Tables, Speculative Decoding

---

## 1. Architectural Overview & Component Topology

```
+---------------------------------------------------------------------------------+
|                       EosSpeculativePagedKvCacheCore                            |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [Paged Virtual Memory Manager]                [Speculative Decoding Engine]    |
|  +------------------------------+             +-------------------------------+ |
|  | Physical Block Pool          |             | Draft Model (Fast Predictor)  | |
|  | (Fixed-size blocks: B=16)    |             | - Generates K candidates      | |
|  | Free List / Allocation Bitset|             +---------------+---------------+ |
|  +--------------+---------------+                             |                 |
|                 |                                             v                 |
|  +--------------v---------------+             +---------------+---------------+ |
|  | Per-Sequence Page Tables     |             | Target Model (Single Pass)    | |
|  | Logical Page -> Physical Blk |             | - Evaluates all K in parallel | |
|  +--------------+---------------+             +---------------+---------------+ |
|                 |                                             |                 |
|  +--------------v---------------+                             v                 |
|  | Virtual Block Slicer         |             +---------------+---------------+ |
|  | Read/Write without memcpy    |             | Speculative Verifier          | |
|  +------------------------------+             | - Accept first M tokens       | |
|                                               | - Emit correction token M+1   | |
|                                               +-------------------------------+ |
+---------------------------------------------------------------------------------+
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-179-001: Paged Virtual Memory Table vs Contiguous Tensor Allocation

- **Status**: ACCEPTED
- **Context**: Allocating contiguous KV-cache buffers sized to max context length $L_{\max}$ causes 60-80% memory waste through internal and external fragmentation. Dynamic array reallocations introduce latency spikes and heap garbage collection pressure.
- **Decision**: Adopt operating system virtual memory concepts (analogous to vLLM's PagedAttention). Pre-allocate a contiguous pool of physical memory blocks of fixed size (default $B = 16$ tokens). Maintain a per-sequence Page Table that maps logical block indices to physical block indices. Allocate blocks on demand when sequences grow and return blocks to the free list when sequences terminate.
- **Consequences**:
  - Positive: Zero external memory fragmentation; predictable memory bounds; ability to serve multiple concurrent sequences without OOM.
  - Tradeoff: Slight pointer indirection overhead when gathering keys and values during attention computation, easily bounded to $< 50\,\mu\text{s}$ using typed integer arrays.

### ADR-179-002: Single-Pass Parallel Target Verification with Token Tree Slicing

- **Status**: ACCEPTED
- **Context**: Traditional autoregressive decoding requires $K$ sequential forward passes of the target model to generate $K$ tokens. Speculative decoding allows generating $K$ tokens using a small fast draft model, which are then evaluated by the target model in a single batched forward pass.
- **Decision**: Implement parallel verification with prefix matching:
  1. The draft model generates $K$ tokens: $\{d_1, d_2, \dots, d_K\}$.
  2. The target model computes logits for context $+ \{d_1, \dots, d_{K-1}\}$ simultaneously in one forward step, yielding target tokens $\{t_1, t_2, \dots, t_K, t_{K+1}\}$.
  3. Compare $d_i$ against $t_i$ sequentially. The first mismatch index $M \in [0, K]$ determines that $\{d_1, \dots, d_M\}$ are accepted, and $t_{M+1}$ is accepted as the correction token.
- **Consequences**:
  - Positive: Always produces $M+1 \ge 1$ tokens per target forward pass; when the draft model is accurate, yields $K+1$ tokens in 1 target pass (up to $3\times$ speedup).
  - Tradeoff: Requires coordinating draft and target vocabularies and context synchronization.

### ADR-179-003: Fixed Block Sizing and Pre-allocated Typed Buffers

- **Status**: ACCEPTED
- **Context**: Dynamic allocations in JavaScript engines create object overhead and GC pauses.
- **Decision**: Pre-allocate a single contiguous `Float32Array` or `Int32Array` representing all physical blocks ($\text{TotalBlocks} \times \text{BlockSize} \times \text{Dim}$). Use integer indexing for all page table mappings.
- **Consequences**:
  - Positive: Constant memory footprint; zero runtime allocations; maximum cache locality.
  - Tradeoff: Maximum pool capacity must be established at initialization.
