# PLAN-187: Expert Parallelism & Mixture-of-Experts (MoE) Routing Engine

**Reference**: `SPEC-325` / `CHANGE-187`  
**System**: Glorian System Control Plane (`eos-system`)  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Architectural Overview

Mixture-of-Experts (MoE) with Expert Parallelism (EP) shards $E$ total experts across $P$ workers, such that each worker hosts $E/P$ experts. The execution pipeline follows:

```
Tokens [T, D] -> Router Logits [T, E] -> Top-K Gating -> Dispatch Slots (Capacity Bounded)
                                                                |
                                                                v
[Worker 0..P-1] <===== All-to-All Collective Dispatch <=========+
      |
      v
Local Expert Feed-Forward Execution (MLP_e for e in local_experts)
      |
      v
[Worker 0..P-1] ======> All-to-All Collective Combine =========>+
                                                                |
                                                                v
Token Recombination: Output[t] = \sum_{k=1}^K G_{t,k} \cdot ExpertOutput_{t,k}
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-187-001: Top-K Softmax Gating with Renormalization

- **Context**: Standard dense gating routes tokens to all $E$ experts. Sparse MoE must activate strictly $K \ll E$ experts to maintain constant compute.
- **Decision**: Evaluate softmax probabilities over router projections $H \cdot W_g$. Select indices corresponding to the $K$ largest logits, zero out non-selected experts, and renormalize gating weights over the chosen $K$ experts such that $\sum_{k=1}^K G_{t,k} = 1.0$.
- **Consequences**: Deterministic, bounded compute per token. Mathematically differentiable and gradient-attributed.

### ADR-187-002: Capacity Factor Bounded Buffers & Deterministic Overflow

- **Context**: Dynamic token allocations can skew heavily toward a few popular experts, risking GPU OOM (Out Of Memory) or straggler worker stalls.
- **Decision**: Enforce a fixed capacity buffer per expert: $C_{\text{max}} = \lceil \frac{K \cdot T}{E} \cdot C \rceil$, with default $C = 1.25$ or $1.0$. Tokens routed to an expert whose buffer is full are dropped from expert computation and passed directly through the residual connection.
- **Consequences**: Guarantees static memory allocation and prevents cluster-wide OOM crashes under non-uniform token distributions.

### ADR-187-003: Two-Phase All-to-All Collective Communication

- **Context**: Tokens reside on data-parallel ranks, while experts reside on expert-parallel ranks.
- **Decision**: Use a two-phase collective exchange:
  1. **All-to-All Dispatch**: Shuffles token vectors from token owners to expert host ranks based on the Top-$K$ routing assignments.
  2. **All-to-All Combine**: Shuffles computed expert output vectors back to token owner ranks for weighted summation.
- **Consequences**: Minimizes communication latency by packing token representations into contiguous collective transfer buffers.

---

## 3. Formal Verification Strategy (TLA+ Model 69)

- **Spec**: `docs/formal/ExpertParallelMoERouter.tla` & `ExpertParallelMoERouter.cfg`.
- **Invariants**:
  - `TypeOK`: Phase integrity (`INIT`, `ROUTED`, `DISPATCHED`, `COMPUTED`, `COMBINED`, `DONE`).
  - `CapacityBounded`: No expert buffer exceeds $C_{\text{max}}$.
  - `ConservationOfTokens`: Total tokens processed plus dropped tokens equals $K \cdot T$.
  - `ZeroResidualLeakage`: Intermediate dispatch and combine buffers are purged post-step.
