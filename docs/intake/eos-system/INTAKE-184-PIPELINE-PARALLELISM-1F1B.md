# INTAKE-184: Pipeline Parallelism Engine (1F1B Interleaved Activation Schedule)

---

## 1. Problem Statement

When neural network parameters span across multiple hardware accelerators or workers due to model scale, layer-wise pipeline parallelism is essential. However, naive pipeline schedules (such as GPipe) suffer from two catastrophic defects:

1. **Memory Explosion**: All micro-batches execute their forward passes sequentially before any backward pass begins. Consequently, stage 0 must retain stashed intermediate activations for all $M$ micro-batches in memory, scaling activation memory linearly $O(M)$ and inducing Out-Of-Memory (OOM) crashes for large batch sizes.
2. **Severe Pipeline Bubble**: The pipeline bubble fraction $F_{\text{bubble}} = \frac{P - 1}{M + P - 1}$ reduces hardware utilization if micro-batch count $M$ is constrained by memory limits.

## 2. 1F1B (One Forward, One Backward) Mathematical Formulation

The 1F1B schedule (PipeDream / Megatron-LM) solves the memory scaling bottleneck by interleaving forward and backward passes:

1. **Warmup Phase**:
   - Each stage $p \in \{0, \dots, P - 1\}$ executes $P - p - 1$ warmup forward micro-batch passes.
   - Stage 0 executes $P - 1$ forward passes; the final stage $P - 1$ executes 0 warmup passes and transitions immediately into backward processing upon receiving its first micro-batch.
2. **Steady-State (1F1B Phase)**:
   - For every forward micro-batch pass executed, the stage immediately executes one backward pass on the oldest in-flight micro-batch.
   - **Peak Activation Memory Invariant**: The maximum number of concurrently stored activation tensors on any pipeline stage is strictly bounded by $P$, regardless of how large the total micro-batch count $M$ is:
     $$\text{Peak In-Flight Activations}(p) \le P - p \le P$$
3. **Cooldown Phase**:
   - Once all $M$ forward passes have completed, the stage drains the remaining in-flight micro-batches through backward passes.

## 3. Communication Pattern

- Inter-stage communication is strictly point-to-point (P2P) between adjacent neighbors:
  - Forward: Stage $p \to$ Stage $p + 1$ (activations)
  - Backward: Stage $p + 1 \to$ Stage $p$ (activation gradients $\nabla_A$)
- No all-to-all or all-reduce collective communications are required across pipeline stages, eliminating global communication synchronization barriers.

## 4. Key Metrics to Verify

- **Peak Memory Bound**: Stashed activations $\le P$ at all iteration steps.
- **Micro-Batch Execution Parity**: All $M$ micro-batches execute forward and backward passes in valid topological order.
- **Zero Activation Leakage**: Stashed activation cache is empty ($= 0$) upon schedule completion.
- **Bubble Efficiency**: Measured bubble fraction matches theoretical bound $\frac{P - 1}{M}$.
