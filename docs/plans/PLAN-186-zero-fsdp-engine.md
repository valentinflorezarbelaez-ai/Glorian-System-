# PLAN-186: ZeRO (Zero Redundancy Optimizer) & Fully Sharded Data Parallel (FSDP) Engine

**Reference**: `SPEC-324` / `CHANGE-186`  
**System**: Glorian System Control Plane (`eos-system`)  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Architectural Overview

ZeRO eliminates memory redundancies in distributed training across three progressive stages:

```
Standard DDP (Replicated Parameters, Gradients, Optimizer States):
  Worker 0: [ Params: Psi ] [ Grads: Psi ] [ OptStates: 12 * Psi ] -> Total: 14 * Psi
  Worker 1: [ Params: Psi ] [ Grads: Psi ] [ OptStates: 12 * Psi ] -> Total: 14 * Psi

ZeRO-Stage 1 (Optimizer State Sharding P_os):
  Worker 0: [ Params: Psi ] [ Grads: Psi ] [ OptStates: 12 * Psi / P ]
  Worker 1: [ Params: Psi ] [ Grads: Psi ] [ OptStates: 12 * Psi / P ]

ZeRO-Stage 2 (Optimizer State + Gradient Sharding P_os+g):
  Worker 0: [ Params: Psi ] [ Grads: Psi / P ] [ OptStates: 12 * Psi / P ]
  Worker 1: [ Params: Psi ] [ Grads: Psi / P ] [ OptStates: 12 * Psi / P ]

ZeRO-Stage 3 / FSDP (Parameter + Gradient + Optimizer State Sharding P_os+g+p):
  Worker 0: [ Params: Psi / P ] [ Grads: Psi / P ] [ OptStates: 12 * Psi / P ] -> Linear O(Psi / P)
  Worker 1: [ Params: Psi / P ] [ Grads: Psi / P ] [ OptStates: 12 * Psi / P ] -> Linear O(Psi / P)
  (Parameters reconstructed transiently per layer via All-Gather and purged immediately).
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-186-001: Progressive Stage Decoupling (ZeRO-1 vs ZeRO-2 vs ZeRO-3)

- **Context**: Different training cluster bandwidths benefit from different trade-offs: ZeRO-1 has zero extra communication; ZeRO-3 incurs $1.5\times$ communication but unlocks unbounded parameter counts.
- **Decision**: Architect `EosZeroFsdpCore` with explicit progressive stage dispatchers (`stepZeRO1`, `stepZeRO2`, `stepZeRO3`) allowing runtime selection per workload.
- **Rationale**: Provides maximum engineering flexibility for both high-bandwidth NVLink nodes (ZeRO-3) and low-bandwidth cross-datacenter interconnects (ZeRO-1).
- **Rejected Alternatives**:
  - _All-or-nothing ZeRO-3_: Forces communication overhead onto workloads that only need optimizer state reduction.

### ADR-186-002: Just-In-Time Parameter Re-Gathering with Immediate Purge

- **Context**: In ZeRO-3/FSDP, holding gathered parameters across the full forward pass causes activation/parameter memory spikes equivalent to standard DDP.
- **Decision**: Layer-by-layer dynamic All-Gather: reconstruct parameters of layer $L$, compute layer forward/backward, and immediately deallocate un-sharded layer parameters before proceeding to layer $L+1$.
- **Rationale**: Keeps peak memory strictly bounded to $\frac{\Psi}{P} + \max_L(\Psi_L)$ instead of $\Psi$.
- **Rejected Alternatives**:
  - _Full model All-Gather before forward pass_: Completely defeats the parameter memory savings of ZeRO-3.

### ADR-186-003: Host Memory (CPU RAM) Offloading Queue

- **Context**: For extreme model scales where even $\Psi / P$ exceeds GPU VRAM, optimizer states must be placed in host memory.
- **Decision**: Implement an offloading buffer abstraction with asynchronous host-to-device transfers.
- **Rationale**: Enables training models that exceed physical cluster accelerator memory without rewriting optimizer logic.
- **Rejected Alternatives**:
  - _Disk-only swapping_: Introduces severe I/O latency bottlenecks compared to host DRAM DMA.
