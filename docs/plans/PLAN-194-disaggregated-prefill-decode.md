# PLAN-194: Disaggregated Prefill & Decode Serving Engine (PD Separation, Chunked Prefill & Zero-Copy KV Transfer)

## 1. Architectural Strategy & Topology

The Disaggregated Prefill and Decode (PD Separation) architecture physically decouples the compute-bound prompt ingestion phase from the memory-bandwidth-bound autoregressive decoding phase.

```
Incoming Request
       │
       ▼
┌───────────────────────────────┐
│ EosDisaggregatedPrefillDecode │
│ Global Inference Scheduler    │
└──────────────┬────────────────┘
               │
      Prompt   │   Chunked Prefill (B_chunk = 256..512)
               ▼
┌───────────────────────────────┐
│     Prefill Worker Pool       │  <-- High FLOPs (Tensor Parallel Prefill)
│   (W_prefill_0, W_prefill_1)  │
└──────────────┬────────────────┘
               │
               │  Zero-Copy Paged KV Cache Transfer + SHA-256 Checksum
               ▼
┌───────────────────────────────┐
│      Decode Worker Pool       │  <-- High KV Capacity (Low TPOT Autoregressive)
│ (W_decode_0 ... W_decode_3)   │
└──────────────┬────────────────┘
               │
               ▼  Streamed Output Tokens (TPOT <= 15 ms/token)
```

---

## 2. Architecture Decision Records (ADRs)

### ADR-194-001: Disaggregated Worker Topology vs Colocated Continuous Batching

- **Context**: Colocating prefill and decode causes severe head-of-line blocking: a 32K token prefill monopolizes tensor cores for hundreds of milliseconds, pausing ongoing token generation on co-scheduled decode streams.
- **Decision**: Physically separate nodes into `PREFILL` workers and `DECODE` workers. Prefill workers perform tensor-heavy parallel matrix multiplications; Decode workers execute memory-bandwidth-bound step-wise decoding.
- **Rejected Alternative**: Naive continuous batching with prefill-decode interleaving on identical GPUs, which cannot eliminate micro-stutters and tail-latency degradation under high prefill concurrency.

### ADR-194-002: Chunked Prefill with Fixed Token Budget

- **Context**: Very long prompts can cause queuing delays even in dedicated prefill pools, preventing smaller prompts from completing prefill promptly.
- **Decision**: Partition prompts longer than $B_{\text{chunk}}$ (e.g. 256 or 512 tokens) into sequential micro-chunks. The scheduler yields control between chunks, allowing fair multiplexing across concurrent prefill jobs.
- **Rejected Alternative**: Monolithic prefill execution, which exhibits $\mathcal{O}(T^2)$ starvation for concurrent short-prompt requests.

### ADR-194-003: Zero-Copy Page Table Transfer with Cryptographic Integrity

- **Context**: Migrating KV cache between nodes over interconnects must not cause memory thrashing or CPU heap overhead.
- **Decision**: Paged memory layout where KV blocks are structured into fixed-size physical pages. Migration transfers page metadata and contiguous memory slices with a 256-bit cryptographic SHA-256 checksum to guarantee payload authenticity before the decode node attaches pages to its local page table.
- **Rejected Alternative**: Deserializing and copying individual token key/value vectors on the heap, which causes unacceptable latency overhead and GC pressure.
