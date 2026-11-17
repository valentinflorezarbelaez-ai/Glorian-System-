# TASKS-190: FP8 / INT8 Quantized Distributed Training & Mixed-Precision Gradient Scaling Engine

**Reference**: `SPEC-328` / `CHANGE-190`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-190-1: Formal TLA+ Model 72]
         |
         v
[TASK-190-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-190-3: CLI Dispatcher]   [TASK-190-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-190-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [ ] **TASK-190-1: Formal TLA+ Model 72**
  - File: `docs/formal/QuantizedDistributedTrainingEngine.tla` & `QuantizedDistributedTrainingEngine.cfg`
  - Invariants: `TypeOK`, `ScaleStability`, `SaturationRecovery`, `BandwidthReduction`, `WeightIntegrity`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [ ] **TASK-190-2: Core Domain Types & Engine**
  - Files: `src/core/eosQuantizedDistributedTrainingEngine.types.ts`, `src/core/eosQuantizedDistributedTrainingEngine.ts`
  - Class: `EosQuantizedDistributedTrainingCore`
  - Methods:
    - `quantizeFP8(tensor, format, scale)` & `dequantizeFP8(tensor, format, scale)`
    - `quantizeINT8(tensor, scale)` & `dequantizeINT8(tensor, scale)`
    - `updateDelayedScaling(history, currentMax, fp8Format)`
    - `backwardWithMixedPrecision(loss, gradients, lossScaleState)`
    - `simulateQuantizedAllReduce(gradients, numWorkers, format)`
    - `audit(tensorDim, numWorkers, lossSteps)`
  - Done Criteria: Typecheck clean, exported in `src/core/index.ts` with $\le 800$ lines, headroom $\ge 12$ lines.

- [ ] **TASK-190-3: CLI Dispatcher & Router Parity (563 -> 568)**
  - File: `bin/commands/cliQuantizedDistributedTrainingEngine.mjs`
  - Commands: `toolchain:quanttrain:fp8`, `toolchain:quanttrain:scaling`, `toolchain:quanttrain:backward`, `toolchain:quanttrain:bandwidth`, `toolchain:quanttrain:audit`.
  - Router: `bin/commands/cliToolchainRouter.mjs`
  - Catalog: `bin/commands/cliHelpCatalog.mjs`
  - Guide: `docs/DEVELOPER_GUIDE.md`
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` passes with `HYGIENE_GOVERNED`.

- [ ] **TASK-190-4: BDD Test Suite & Coverage Budget**
  - File: `test/eosQuantizedDistributedTrainingEngine.test.mjs`
  - Coverage: `docs/quality/coverage-budget.json` (lines: 80.0%, branches: 70.0%)
  - Evidence: `docs/evidence/QUANTIZED_DISTRIBUTED_TRAINING_RECEIPT.json`
  - Done Criteria: 6/6 BDD tests passing (BDD-1743..1748).

- [ ] **TASK-190-5: CI/CD Gate, Seal & Origin Push**
  - Execute: `node scripts/verify-fast.mjs`
  - Commit: Conventional commit with signed freeze pin seal
  - Push: Clean synchronization to `origin/main`.
