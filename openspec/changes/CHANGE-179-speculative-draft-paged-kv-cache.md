# CHANGE-179: Speculative Multi-Token Draft Verification & Paged KV-Cache Attention Engine

**Change ID**: CHANGE-179  
**Specification**: SPEC-317  
**Status**: PROPOSED  
**Priority**: CRITICAL / HIGH_PERFORMANCE_INFERENCE  
**Domain**: Deep Learning Inference, Virtual Memory Block Allocation, Speculative Decoding

---

## 1. Description & Intent

To provide the Glorian System with state-of-the-art inference efficiency on par with leading Big Tech AI research systems (Google DeepMind, vLLM, OpenAI Triton), this change establishes:

1. **Virtual Paged KV-Cache Engine**:
   - Fixed-size physical block allocation (default 16 tokens/block) backed by contiguous typed buffers.
   - Per-sequence Page Table maintaining logical-to-physical block pointers.
   - Dynamic block allocation and reclamation on sequence extension or termination, eliminating external memory fragmentation.
   - Sub-microsecond address resolution with zero-copy buffer slicing.
2. **Speculative Multi-Token Draft Tree Verification**:
   - Small draft model generates $K$ candidate tokens ($K \in [2, 8]$).
   - Single forward evaluation pass by the target model over all $K$ candidates simultaneously.
   - Exact speculative acceptance criteria (greedy exact match or calibrated probability quotient).
   - Early rejection short-circuit at the first mismatched token $i \le K$, preserving autoregressive distribution equivalence.
3. **Formal Verification (TLA+ Model 61)**:
   - Leslie Lamport's TLC model verification covering:
     - `SpeculativeEquivalence`: Autoregressive distribution parity.
     - `NoBlockLeak`: Complete physical block accounting and reclamation.
     - `MonotonicPageTable`: Invariant monotonicity and bounds of page table entries.
4. **Toolchain CLI Suite**:
   - `toolchain:speculative:pagetable`: Inquire page table mapping and fragmentation index.
   - `toolchain:speculative:allocate`: Allocate or extend physical KV-cache blocks for a sequence.
   - `toolchain:speculative:draft`: Generate speculative candidate tokens.
   - `toolchain:speculative:verify`: Parallel verification with acceptance rate metrics.
   - `toolchain:speculative:audit`: Verify structural invariants and generate cryptographic SHA-256 receipt.

## 2. Invariants & Non-Negotiable Rules

- Zero runtime external dependencies (`dependencies: {}` in `package.json`).
- All module files strictly $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
- 100% CLI catalog parity across router, catalog, and documentation.
- Node 24 strip-only syntax compliance.
- Signed SHA-256 receipt emitted on audit: `docs/evidence/SPECULATIVE_PAGED_KV_CACHE_RECEIPT.json`.
