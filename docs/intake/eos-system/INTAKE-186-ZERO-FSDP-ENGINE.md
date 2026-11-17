# INTAKE-186: ZeRO (Zero Redundancy Optimizer) & Fully Sharded Data Parallel (FSDP) Engine

**Reference**: `SPEC-324` / `CHANGE-186`  
**System Target**: Glorian System Control Plane (`eos-system`)  
**Domain**: Distributed Deep Learning / Memory Optimization / ZeRO & FSDP  
**Author**: Valentin Florez Arbelaez & EOS Autonomous Architecture Engine  
**Status**: APPROVED  
**Date**: 2026-11-17

---

## 1. Context & Business Intent

In large-scale deep learning model training, standard Data Parallelism (DDP) replicates model parameters, gradients, and optimizer states across every worker. For modern trillion-parameter models, optimizer states (such as FP32 Adam master weights, first momentum $m$, and second momentum $v$) consume the vast majority of GPU memory ($16 \times \Psi$ bytes), far exceeding parameter memory alone.

To unlock scalable training of massive models across heterogeneous distributed clusters without out-of-memory crashes, Glorian System requires a sovereign Layer-0 **ZeRO / FSDP Engine** (`EosZeroFsdpCore`) implementing:

1. **ZeRO-Stage 1 ($P\_{os}$ — Optimizer State Sharding)**:
   - Partitions Adam optimizer states ($m, v$, master FP32 weights) across $P$ workers, achieving a $4\times$ reduction in memory without altering communication volume ($2\Psi$ All-Reduce of gradients).
2. **ZeRO-Stage 2 ($P\_{os+g}$ — Gradient Sharding)**:
   - Partitions both optimizer states and gradients across $P$ workers using **Reduce-Scatter** during the backward pass, keeping only $1 / P$ of gradients on each worker and freeing the rest immediately.
3. **ZeRO-Stage 3 / FSDP ($P\_{os+g+p}$ — Parameter Sharding)**:
   - Partitions model parameters, gradients, and optimizer states evenly across $P$ workers ($O(\Psi / P)$ memory scaling).
   - Dynamically reconstructs layer parameters just-in-time via **All-Gather** during forward and backward passes, and discards un-sharded layer parameters immediately after layer execution.
   - Gradients are immediately reduced and partitioned via **Reduce-Scatter** and freed.
4. **ZeRO-Infinity Activation & Host Offloading**:
   - Optional offloading of partitioned optimizer states to host memory (CPU RAM) with asynchronous prefetching and bounded communication queues.
5. **Formal Invariant & Convergence Guarantees**:
   - Exact mathematical equivalence to centralized Adam optimizer updates ($\epsilon \le 10^{-6}$).
   - Strict memory ceiling verification proving $M_{ZeRO-3} \approx \frac{M_{DDP}}{P}$.

---

## 2. Invariant Criteria & Quality Guarantees

1. **Memory Scaling Invariant**: $\forall p, \text{Mem}_{p}(\text{ZeRO-3}) \le \frac{\text{Mem}_{\text{DDP}}}{P} + O(\text{LayerMax})$.
2. **Optimizer State Partition Invariant**: Each worker updates strictly its assigned shard $[p \cdot \frac{\Psi}{P}, (p+1) \cdot \frac{\Psi}{P}-1]$.
3. **Single Collective Communication Schedule**: ZeRO-1 uses 1 All-Reduce; ZeRO-2 uses 1 Reduce-Scatter + 1 All-Gather; ZeRO-3 uses 2 All-Gathers + 1 Reduce-Scatter per layer.
4. **Mathematical Equivalence Invariant**: Updated model parameters after optimizer step are identical to monolithic Adam updates within $\epsilon \le 10^{-6}$.
5. **Zero External Runtime Dependencies**: Pure Layer-0 TypeScript module (`dependencies: {}`).
6. **Module Headroom Invariant (`SPEC-250`)**: File lines $\le 800$ lines with $\ge 12$ lines headroom.
