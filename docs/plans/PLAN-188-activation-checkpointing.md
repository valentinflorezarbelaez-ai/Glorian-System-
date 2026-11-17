# PLAN-188: Asynchronous Pipeline Parallelism & Activation Checkpointing Engine

**Reference**: `SPEC-326` / `CHANGE-188`  
**System**: Glorian System Control Plane (`eos-system`)  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Architectural Overview

During deep network training, standard backpropagation retains all layer activations in device memory from the forward pass until the corresponding layer's backward gradient calculation is reached, causing activation memory to scale linearly $O(L)$ with model depth. The **Activation Checkpointing & Recomputation Engine** partitions $L$ layers into $M$ segments, storing only segment boundary activations ($O(M)$ memory). During the backward pass of a segment, activations are recomputed on-the-fly from the stored boundary checkpoint ($O(L/M)$ memory). Setting $M \approx \sqrt{L}$ bounds peak activation memory to $O(\sqrt{L})$:

```
Forward Pass:
[X_0] ===(Layer 1..S)===> [X_S] ===(Layer S+1..2S)===> [X_2S] ... ===> [X_L]
  |                         |                            |
  v (Retain Checkpoint 0)   v (Retain Checkpoint 1)      v (Retain Checkpoint 2)
  [CP_0]                    [CP_1]                       [CP_2]
  (Discard internal)        (Discard internal)           (Discard internal)

Backward Pass (Reverse order of segments):
1. Load [CP_2], recompute Layers 2S+1..L activations forward on-the-fly.
2. Backpropagate gradients through Layers L..2S+1, accumulating dW.
3. Deallocate recomputed transient activations immediately.
4. Backpropagate into [CP_1], repeat for preceding segment.
```

When integrated with **Asynchronous 1F1B Pipeline Parallelism**, forward and backward micro-batches are interleaved such that micro-batch activations are immediately discarded once their backward pass finishes on a pipeline stage, maintaining a strict ceiling of at most $P$ active micro-batches in flight.

---

## 2. Architectural Decision Records (ADRs)

### ADR-188-001: Full Checkpoint Partitioning vs Selective Recomputation

- **Context**: Checkpointing can either discard all activations within each layer (full checkpointing) or retain low-memory/high-compute activations (e.g., attention softmax scores, selective recomputation).
- **Decision**: Support both policies via a configurable strategy:
  1. `FULL_CHECKPOINT`: Retains strictly segment boundary inputs; recomputes all intermediate operations inside the segment during backward propagation.
  2. `SELECTIVE_RECOMPUTE`: Retains large linear projection outputs but discards and recomputes memory-heavy, FLOP-light non-linearities (e.g., activation functions, dropout masks, normalization statistics).
- **Consequences**: `FULL_CHECKPOINT` achieves maximal theoretical memory savings ($O(\sqrt{L})$), while `SELECTIVE_RECOMPUTE` eliminates up to 70% of peak memory with less than 15% compute overhead.

### ADR-188-002: Asynchronous 1F1B Early Buffer Release

- **Context**: In naive pipeline scheduling, all micro-batch forward passes finish before backward passes begin, producing a memory bubble of $N$ micro-batch activation buffers.
- **Decision**: In 1F1B scheduling, after the warm-up phase (which executes up to $P$ forward passes), every subsequent forward pass is paired with an immediate backward pass on an earlier micro-batch. Checkpoints belonging to completed micro-batch backward passes are purged immediately.
- **Consequences**: Activation footprint is strictly capped at $P$ concurrent micro-batches rather than $N$, drastically reducing memory consumption for large batch sizes.

### ADR-188-003: Deterministic Gradient Parity Invariant

- **Context**: Recomputed activations must not introduce numerical drift or divergence when calculating weight gradients $\nabla W$ and input gradients $\nabla X$.
- **Decision**: Ensure that the forward function used in recomputation is identical in precision (single-precision IEEE 754 `Float32Array`) to the primary forward pass, validating $\max |\nabla W_{\text{recompute}} - \nabla W_{\text{standard}}| \le 10^{-6}$.
- **Consequences**: Guarantees zero training degradation or loss divergence while delivering dramatic memory reduction.

---

## 3. Formal Verification Strategy (TLA+ Model 70)

- **Spec**: `docs/formal/ActivationCheckpointingEngine.tla` & `ActivationCheckpointingEngine.cfg`.
- **Invariants**:
  - `TypeOK`: State integrity of micro-batches and layer segment buffers.
  - `MemoryCeilingBounded`: Active activation count never exceeds $\lceil L / M \rceil + M$.
  - `ZeroResidualLeakage`: All activation caches are empty upon step completion.
  - `ConservationOfGradients`: Gradient accumulation matches the reference backpropagation.
