# Architecture Plan & Decision Records: Continuous Dynamic Sequence Batching

**Identifier**: `PLAN-181`
**Target Specification**: `SPEC-319`
**Target Change**: `CHANGE-181`
**Status**: `APPROVED`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Architectural Overview

This plan implements an iteration-level continuous sequence batching engine (`EosContinuousDynamicBatchingCore`) designed to coordinate LLM inference across dynamic sequence lengths without padding bubbles.

The engine coordinates:

1. **Pending Queue**: Priority heap / sorted array storing waiting requests $(R_1, R_2, \dots)$.
2. **Active Slots**: Array of length $B = \text{maxBatchSize}$ containing actively running requests.
3. **Iteration Step ($\Delta t$)**:
   - `admitNewRequests()`: Fills empty slots from pending queue up to memory/block limits.
   - `forwardStep()`: Emits 1 token for each active slot.
   - `checkCompletion()`: Detects EOS or max token limits, emits finished requests to output stream, and frees slots.
   - `handleMemoryPressure()`: Evicts/preempts requests if memory blocks are depleted.

---

## 2. Architecture Decision Records (ADRs)

### ADR-181-001: Iteration-Level Dynamic Scheduling vs Static Batch Scheduling

- **Context**: Static batching bundles requests into fixed-size matrices. If one sequence generates 1000 tokens and three sequences generate 20 tokens, the three slots sit idle for 980 iterations padded with zeros.
- **Decision**: Adopt iteration-level scheduling (Orca model), where each step evaluates slot availability and admits newly arriving sequences immediately.
- **Rejected Alternatives**:
  - _Static Batching_: Rejected due to 50-70% bubble waste and high Time-To-First-Token.
  - _Coarse-grained Dynamic Batching (batch re-organization every 10 steps)_: Rejected because latency spikes still occur at boundaries.
- **Consequences**: Slot utilization $> 90\%$, near-instant TTFT for newly arrived requests.

### ADR-181-002: Preemption Strategy: Recompute vs Swap to Host Memory

- **Context**: When physical memory blocks are exhausted and running sequences demand extensions, at least one sequence must yield resources.
- **Decision**: Implement graceful preemption with recompute metadata tracking. Preempted requests release their KV-cache blocks and are re-enqueued at high priority so they resume as soon as any sequence completes.
- **Rejected Alternatives**:
  - _Hard drop / reject_: Unacceptable in production; violates user request contracts.
  - _Host memory disk swapping_: Introduces high PCIe/disk transfer latency and serialization complexity.
- **Consequences**: Fail-safe memory isolation under extreme memory pressure.

### ADR-181-003: Priority-Aware Earliest-Deadline Scheduling Queue

- **Context**: Production serving handles heterogeneous workloads (interactive chat with high priority vs background batch processing with low priority).
- **Decision**: Sort pending queue by `(priority DESC, arrivalTimestamp ASC)`.
- **Rejected Alternatives**:
  - _Pure FIFO_: Leaves high-priority interactive requests stalled behind massive background jobs.
  - _Strict Preemptive Priority without aging_: Can cause starvation of low-priority requests.
- **Consequences**: Interactive requests achieve sub-millisecond admission while low-priority requests are guaranteed eventual execution.
