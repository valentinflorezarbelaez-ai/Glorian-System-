# CHANGE-184: Pipeline Parallelism Engine (1F1B Interleaved Activation Schedule)

---

## 1. Intent & Scope

- **Specification ID**: `SPEC-322`
- **Change ID**: `CHANGE-184`
- **Domain**: Core Distributed AI & Pipeline Scheduling (`src/core/eosPipelineParallelism1F1B.ts`)
- **Objective**: Implement a high-performance 1F1B (One Forward, One Backward) pipeline parallelism engine with sequential layer sharding across $P \ge 2$ stages, micro-batch streaming ($M \ge P$), peak activation memory bounded strictly by $P$, zero activation cache leakage, neighbor point-to-point communication, and formal TLA+ verification.

## 2. Architectural Blueprint

```
Time (t) ──►
Stage 0: [F0][F1][F2][F3][B0][F4][B1][F5][B2]...[B(M-1)] (Peak Activations <= P)
Stage 1:     [F0][F1][F2][B0][F3][B1][F4][B2]...
Stage 2:         [F0][F1][B0][F2][B1][F3][B2]...
Stage 3:             [F0][B0][F1][B1][F2][B2]... (Zero Warmup; immediate backward)
```

## 3. Deliverables

1. Formal TLA+ Model 66 (`docs/formal/PipelineParallelism1F1B.tla` & `.cfg`) verified with Leslie Lamport's TLC model checker.
2. Core types & implementation (`src/core/eosPipelineParallelism1F1B.types.ts`, `src/core/eosPipelineParallelism1F1B.ts`).
3. 5 CLI commands (`toolchain:pipeline:stages`, `toolchain:pipeline:warmup`, `toolchain:pipeline:1f1b`, `toolchain:pipeline:schedule`, `toolchain:pipeline:audit`) maintaining 100% catalog parity (533 $\to$ 538 commands).
4. BDD test suite (`test/eosPipelineParallelism1F1B.test.mjs`, `BDD-1707`..`BDD-1712`).
5. Cryptographic SHA-256 receipt (`docs/evidence/PIPELINE_PARALLELISM_1F1B_RECEIPT.json`).
