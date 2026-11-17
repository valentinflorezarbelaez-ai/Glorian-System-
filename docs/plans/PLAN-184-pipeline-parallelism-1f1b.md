# PLAN-184: Pipeline Parallelism Engine (1F1B Schedule & Micro-Batching)

---

## 1. Architectural Strategy

To distribute deep multi-layer models without collective communication overhead, the **1F1B (One Forward, One Backward)** pipeline parallelism engine decomposes deep layer graphs sequentially across $P$ stages. The scheduling alternates forward and backward execution on micro-batches to bound in-flight activations to $P$ rather than total batch count $M$.

---

## 2. Architectural Decision Records (ADRs)

### ADR-184-001: 1F1B Interleaved Scheduling vs Naive GPipe

- **Status**: ACCEPTED
- **Context**: GPipe runs all forward passes for $M$ micro-batches before running backward passes. For $M = 32$ and $P = 4$, Stage 0 must store 32 activation states in memory, causing OOM.
- **Decision**: Adopt the 1F1B interleaved schedule where Stage $p$ runs $P - p - 1$ warmup forward steps, and then alternates 1 forward with 1 backward step.
- **Rationale**: Binds maximum activation cache size on any stage to strictly $\le P$. For $M = 32, P = 4$, peak memory is 4 activations instead of 32 (an 8x reduction).
- **Rejected Alternative**: Naive GPipe due to linear memory scaling with micro-batch count.

### ADR-184-002: FIFO Activation Stash Buffer per Stage

- **Status**: ACCEPTED
- **Context**: During forward pass, intermediate activations must be stored until the corresponding backward pass is ready to consume them for gradient computation ($\nabla_W$).
- **Decision**: Implement a deterministic FIFO activation stash map indexed by `microBatchId`.
- **Rationale**: Guarantees deterministic $O(1)$ lookup and deletion when the backward step arrives, ensuring strict zero-leakage upon cooldown completion.

### ADR-184-003: Point-to-Point Local Communication Queues

- **Status**: ACCEPTED
- **Context**: Inter-stage communication in pipeline parallelism only requires transfer between stage $p$ and $p + 1$ (forward) and stage $p$ and $p - 1$ (backward).
- **Decision**: Use dedicated P2P queues between adjacent stages without global barriers.
- **Rationale**: Eliminates synchronization stalls and enables asynchronous overlap between computation and transmission.
