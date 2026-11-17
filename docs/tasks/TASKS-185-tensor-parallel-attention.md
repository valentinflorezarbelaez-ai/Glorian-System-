# TASKS-185: Tensor Parallel Multi-Head & Grouped-Query Attention (TP-MHA / TP-GQA) with Sequence Parallelism & Ring Attention

**Reference**: `SPEC-323` / `CHANGE-185`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-185-1: Formal TLA+ Model 67]
         |
         v
[TASK-185-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-185-3: CLI Dispatcher]   [TASK-185-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-185-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [x] **TASK-185-1: Formal TLA+ Model 67**
  - File: `docs/formal/TensorParallelAttention.tla` & `TensorParallelAttention.cfg`
  - Invariants: `TypeOK`, `HeadConservation`, `SingleBarrierInvariant`, `RingTermination`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [ ] **TASK-185-2: Core Domain Types & Engine**
  - Files: `src/core/eosTensorParallelAttention.types.ts`, `src/core/eosTensorParallelAttention.ts`
  - Class: `EosTensorParallelAttentionCore`
  - Methods: `partitionAttentionHeads`, `forwardLocalAttention`, `forwardTensorParallelAttention`, `forwardRingAttention`, `partitionSequence`, `audit`.
  - Done Criteria: Exported in `src/core/index.ts`, 100% type-safe via `tsc`.

- [ ] **TASK-185-3: CLI Dispatcher & Router Parity**
  - File: `bin/commands/cliTensorParallelAttention.mjs`
  - Commands: `toolchain:tp:mha`, `toolchain:tp:gqa`, `toolchain:tp:ring-attention`, `toolchain:tp:sequence`, `toolchain:tp:audit`.
  - Registered in `cliHelpCatalog.mjs`, `cliToolchainRouter.mjs`, `docs/DEVELOPER_GUIDE.md`.
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` reports `HYGIENE_GOVERNED` (543/543).

- [ ] **TASK-185-4: BDD Test Suite**
  - File: `test/eosTensorParallelAttention.test.mjs`
  - Scenarios: `BDD-1713`..`BDD-1718`
  - Done Criteria: 6/6 tests passing, receipt in `docs/evidence/TENSOR_PARALLEL_ATTENTION_RECEIPT.json`.

- [ ] **TASK-185-5: CI/CD Gate, Seal & Origin Push**
  - Tip-refresh, Prettier formatting, `scripts/verify-fast.mjs`.
  - Commit, seal freeze pin, git push through 7-stage gate to `origin/main`.
