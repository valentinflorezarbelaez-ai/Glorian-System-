# PLAN-191: Distributed Key-Value Cache Replication, Prefix Caching & Speculative KV Prefetching Engine

**Reference**: `SPEC-329` / `CHANGE-191`  
**System**: Glorian System Control Plane (`eos-system`)  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Architectural Overview

During continuous LLM serving, Time-To-First-Token (TTFT) and GPU memory consumption are heavily influenced by the prefill phase. The **Distributed Key-Value Cache Replication, Prefix Caching & Speculative KV Prefetching Engine** (`EosDistributedKvReplicationCore`) introduces an integrated architecture combining prefix-aware deduplication with distributed cluster cache coherence:

```
[Incoming Inference Request: Tokens [t_1, t_2, ..., t_N]]
                           |
                           v
              [Radix Tree Prefix Index]
              /                       \
        (Prefix Hit)             (Prefix Miss)
             |                         |
             v                         v
   [Zero-Copy Block Reuse]     [Prefill Attention on Delta]
   - Retrieve Physical Blocks    - Compute KV for new tokens
   - Bypass Prefill FLOPs        - Allocate Physical Blocks
   - TTFT latency cut up to 90%  - Insert into Radix Tree
                           \         /
                            v       v
             [Distributed P2P Block Synchronizer]
             - Broadcast blocks to peer worker ranks
             - Merkle SHA-256 block hash validation
                            |
                            v
             [Speculative Prefetch Pipeline]
             - Draft model proposes candidate beams
             - Prefetch projected KV blocks into active VRAM
                            |
                            v
             [Context-Aware Memory Governor]
             - Pinned Immortal Blocks (System Prompt): Never evicted
             - Unpinned Leaves: Weighted LRU / LFU Eviction on B_max limit
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-191-001: Hierarchical Radix Tree vs Flat Hash Table Prefix Caching

- **Context**: Prompts frequently share partial prefixes rather than complete prompts (e.g. identical system prompt followed by distinct user questions). A flat hash table only caches exact full-sequence matches.
- **Decision**: Index token sequences in a hierarchical Radix Tree (Prefix Tree) where each node represents a contiguous slice of tokens mapping to physical KV page blocks of fixed size $B$ (e.g. 16 tokens).
- **Consequences**: Enables zero-copy sharing of common ancestor nodes across arbitrary requests, slashing memory consumption and unlocking up to $90\%$ prefill compute savings on shared multi-turn conversations.

### ADR-191-002: Peer-to-Peer Block Sync vs Centralized Remote Cache Broker

- **Context**: In multi-node inference clusters, routing a request to an alternate node requires access to previously computed KV caches. A centralized cache broker creates an interconnect bottleneck and single point of failure.
- **Decision**: Implement a distributed peer-to-peer block replication protocol where worker nodes publish newly allocated prefix blocks to peer nodes with cryptographic SHA-256 block integrity digests.
- **Consequences**: Eliminates centralized broker saturation, provides local cache hits on any cluster worker, and ensures deterministic data integrity across network links.

### ADR-191-003: Speculative KV Prefetching and Pinned Block Protection

- **Context**: In speculative decoding, draft models generate multiple candidate token branches. Waiting for verification before loading candidate KV caches causes pipeline stalls. Furthermore, memory pressure must not evict core agent instructions.
- **Decision**: Introduce speculative KV prefetching to asynchronously stage predicted candidate blocks into active accelerator buffers, and enforce an immutable `isPinned = true` flag on system prompt blocks exempting them from LRU/LFU eviction.
- **Consequences**: Guarantees zero eviction of system prompts while hiding memory staging latency behind concurrent generation computation.

---

## 3. Formal Verification Strategy (TLA+ Model 73)

- **Spec**: `docs/formal/DistributedKvCacheReplication.tla` & `DistributedKvCacheReplication.cfg`.
- **Model Checker**: Leslie Lamport's TLC (`scripts/run-tlc.mjs` and native execution).
- **Invariants**:
  - `TypeOK`: State invariants for Radix Tree nodes, physical blocks, workers, and memory buffers.
  - `MemoryCeilingBounded`: Total physical allocated blocks never exceed $B_{\max}$.
  - `PinnedImmunity`: Pinned physical blocks are never in the evicted block set.
  - `PrefixConsistency`: Any retrieved prefix path strictly preserves the token order and block mappings.
  - `ReplicationIntegrity`: Replicated blocks across workers match the original source block.
