# Architecture Plan & Decision Records: Ring All-Reduce Distributed Tensor Parallelism

**Identifier**: `PLAN-182`
**Target Specification**: `SPEC-320`
**Target Change**: `CHANGE-182`
**Status**: `APPROVED`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Architectural Overview

This plan implements the Ring All-Reduce collective communication algorithm (Patarasuk & Yuan 2009, Gibiansky 2017) to synchronize tensors across $P$ workers without centralized bottlenecks.

Total communication steps:

- $P - 1$ steps of **Scatter-Reduce**: workers send and receive chunks simultaneously, accumulating sums locally.
- $P - 1$ steps of **All-Gather**: workers circulate the fully reduced chunks.
  Total network volume per worker: $2 \cdot \frac{P - 1}{P} \cdot M \cdot 4\,\text{bytes}$.

---

## 2. Architecture Decision Records (ADRs)

### ADR-182-001: Logical Ring All-Reduce vs Parameter Server Master-Worker

- **Context**: Centralized parameter servers require the coordinator to receive $P \times M$ data and broadcast $P \times M$ data, leading to severe network saturation as $P$ increases.
- **Decision**: Adopt logical ring topology where each worker only communicates with its immediate predecessor and successor in parallel.
- **Rejected Alternatives**:
  - _Parameter Server Architecture_: Rejected due to linear $O(P)$ network bandwidth scaling and single-point-of-failure.
  - _All-to-All Direct Mesh_: Rejected due to quadratic $O(P^2)$ socket/connection explosion.
- **Consequences**: Bandwidth optimality: communication time is independent of worker count $P$ for large $M$.

### ADR-182-002: Dual-Phase (Scatter-Reduce + All-Gather) Execution Pipeline

- **Context**: A full reduction requires computing the global element-wise sum and broadcasting it to every participating node.
- **Decision**: Decompose into two distinct, symmetric phases:
  1. _Scatter-Reduce_: Accumulates partial sums so each worker ends up owning 1 fully reduced chunk.
  2. _All-Gather_: Circulates the fully reduced chunks so every worker ends up holding all chunks.
- **Rejected Alternatives**:
  - _Tree All-Reduce (Recursive Halving / Doubling)_: Tree reduction has lower latency for small tensors but suffers from non-uniform link utilization on asymmetric network fabrics.
- **Consequences**: Uniform link utilization across all network interfaces.

### ADR-182-003: Fixed-Size Chunk Padding & Tail Truncation Strategy

- **Context**: When tensor length $M$ is not divisible by $P$, chunks would have uneven lengths, causing communication deadlocks and mismatched buffer transfers.
- **Decision**: Pad the input tensor with zeros to length $P \times \lceil M / P \rceil$, execute the ring reduction uniformly on equal-sized chunks, and truncate the trailing padding elements upon completion.
- **Rejected Alternatives**:
  - _Variable-length chunk transfers_: Rejected due to complex buffer negotiation and potential buffer overruns.
- **Consequences**: Deterministic, zero-copy sliced memory alignment.
