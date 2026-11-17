# TASKS-188: Asynchronous Pipeline Parallelism & Activation Checkpointing Engine

**Reference**: `SPEC-326` / `CHANGE-188`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-188-1: Formal TLA+ Model 70]
         |
         v
[TASK-188-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-188-3: CLI Dispatcher]   [TASK-188-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-188-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [ ] **TASK-188-1: Formal TLA+ Model 70**
  - File: `docs/formal/ActivationCheckpointingEngine.tla` & `ActivationCheckpointingEngine.cfg`
  - Invariants: `TypeOK`, `MemoryCeilingBounded`, `ZeroResidualLeakage`, `ConservationOfGradients`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [ ] **TASK-188-2: Core Domain Types & Engine**
  - Files: `src/core/eosActivationCheckpointingEngine.types.ts`, `src/core/eosActivationCheckpointingEngine.ts`
  - Class: `EosActivationCheckpointingCore`
  - Methods:
    - `forwardWithCheckpoints(inputs, layers, policy)`
    - `backwardWithRecomputation(lossGrads, layers, checkpoints, policy)`
    - `standardForwardBackward(inputs, layers)`
    - `async1F1BSchedule(microBatches, numStages, policy)`
    - `audit(numLayers, microBatches, hiddenDim)`
  - Done Criteria: Typecheck clean, exported in `src/core/index.ts` with $\le 800$ lines, headroom $\ge 12$ lines.

- [ ] **TASK-188-3: CLI Dispatcher & Router Parity (553 -> 558)**
  - File: `bin/commands/cliActivationCheckpointingEngine.mjs`
  - Commands: `toolchain:checkpoint:full`, `toolchain:checkpoint:selective`, `toolchain:checkpoint:async-1f1b`, `toolchain:checkpoint:memory`, `toolchain:checkpoint:audit`.
  - Router: `bin/commands/cliToolchainRouter.mjs`
  - Catalog: `bin/commands/cliHelpCatalog.mjs`
  - Guide: `docs/DEVELOPER_GUIDE.md`
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` passes with `HYGIENE_GOVERNED`.

- [ ] **TASK-188-4: BDD Test Suite & Coverage Budget**
  - File: `test/eosActivationCheckpointingEngine.test.mjs`
  - Coverage: `docs/quality/coverage-budget.json` (lines: 80.0%, branches: 70.0%)
  - Evidence: `docs/evidence/ACTIVATION_CHECKPOINTING_RECEIPT.json`
  - Scenarios: `BDD-1731`..`BDD-1736` (6/6 passing).

- [ ] **TASK-188-5: CI/CD Gate, Seal & Origin Push**
  - Linear rebase on `origin/main`.
  - Pass 7-stage pre-push CI/CD gate.
  - Seal freeze pin to HEAD.
  - Engram observation recorded.
