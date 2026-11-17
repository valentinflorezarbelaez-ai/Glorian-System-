# CHANGE-185: Tensor Parallel Multi-Head & Grouped-Query Attention (TP-MHA / TP-GQA) with Sequence Parallelism & Ring Attention

**Change Reference**: `CHANGE-185`  
**Specification Reference**: `SPEC-323`  
**Scope**: `src/core/`, `bin/commands/`, `test/`, `docs/formal/`  
**Status**: PROPOSED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Intent & Purpose

This change introduces the sovereign **Tensor Parallel Attention Engine** (`EosTensorParallelAttentionCore`), completing the distributed transformer core alongside `RingAllReduce` (`SPEC-320`), `MegatronTensorParallelism` (`SPEC-321`), and `PipelineParallelism1F1B` (`SPEC-322`). It enables sharded Multi-Head Attention (MHA), Grouped-Query Attention (GQA), Sequence Parallelism, and Ring Attention with formal TLA+ mathematical verification and zero runtime external dependencies.

---

## 2. Delta Specification

### Added Capabilities:

- `src/core/eosTensorParallelAttention.types.ts`: Type definitions for TP attention configs, head partitions, GQA mappings, sequence slices, and audit receipts.
- `src/core/eosTensorParallelAttention.ts`: Core class `EosTensorParallelAttentionCore` implementing:
  - `partitionAttentionHeads(config)`: Divides query and key-value heads evenly across $P$ workers.
  - `forwardLocalAttention(Q, K, V)`: Computes local attention for assigned heads using online softmax.
  - `forwardTensorParallelAttention(X, W_q, W_k, W_v, W_o)`: Complete MHA/GQA block with 1 All-Reduce barrier.
  - `forwardRingAttention(Q_local, K_local, V_local)`: Ring-based circular Key-Value shifting for long contexts.
  - `partitionSequence(X)`: Sequence parallelism slicing across workers.
  - `audit()`: Cryptographic invariant verification and SHA-256 seal.
- `docs/formal/TensorParallelAttention.tla` & `.cfg`: Formal TLA+ Model 67 verified with Leslie Lamport's TLC.
- `bin/commands/cliTensorParallelAttention.mjs`: 5 new CLI commands under `toolchain:tp:`.
- `test/eosTensorParallelAttention.test.mjs`: BDD test suite covering scenarios `BDD-1713`..`BDD-1718`.
