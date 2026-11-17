# TASKS-187: Expert Parallelism & Mixture-of-Experts (MoE) Routing Engine

**Reference**: `SPEC-325` / `CHANGE-187`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-187-1: Formal TLA+ Model 69]
         |
         v
[TASK-187-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-187-3: CLI Dispatcher]   [TASK-187-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-187-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [ ] **TASK-187-1: Formal TLA+ Model 69**
  - File: `docs/formal/ExpertParallelMoERouter.tla` & `ExpertParallelMoERouter.cfg`
  - Invariants: `TypeOK`, `CapacityBounded`, `ConservationOfTokens`, `ZeroResidualLeakage`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [ ] **TASK-187-2: Core Domain Types & Engine**
  - Files: `src/core/eosExpertParallelMoERouter.types.ts`, `src/core/eosExpertParallelMoERouter.ts`
  - Class: `EosExpertParallelMoECore`
  - Methods:
    - `partitionExperts(totalExperts, numWorkers)`
    - `routeTopK(tokenRepresentations, routerWeights, topK, capacityFactor)`
    - `computeAuxiliaryLoss(gatingProbabilities, tokenDispatchFractions, alpha)`
    - `allToAllDispatch(tokens, routingIndices, numWorkers)`
    - `executeLocalExperts(dispatchedTokens, expertWeights)`
    - `allToAllCombine(expertOutputs, routingIndices, gatingWeights, numWorkers)`
    - `audit(numWorkers, numExperts, numTokens, hiddenDim)`
  - Done Criteria: Typecheck clean, exported in `src/core/index.ts` with $\le 800$ lines, headroom $\ge 12$ lines.

- [ ] **TASK-187-3: CLI Dispatcher & Router Parity (548 -> 553)**
  - File: `bin/commands/cliExpertParallelMoERouter.mjs`
  - Commands: `toolchain:moe:route`, `toolchain:moe:capacity`, `toolchain:moe:alltoall`, `toolchain:moe:auxloss`, `toolchain:moe:audit`.
  - Router: `bin/commands/cliToolchainRouter.mjs`
  - Catalog: `bin/commands/cliHelpCatalog.mjs`
  - Guide: `docs/DEVELOPER_GUIDE.md`
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` passes with `HYGIENE_GOVERNED`.

- [ ] **TASK-187-4: BDD Test Suite & Coverage Budget**
  - File: `test/eosExpertParallelMoERouter.test.mjs`
  - Scenarios: `BDD-1725`..`BDD-1730`
  - Budget: `docs/quality/coverage-budget.json`
  - Done Criteria: 6/6 tests passing, signed receipt in `docs/evidence/MOE_ROUTER_RECEIPT.json`.

- [ ] **TASK-187-5: CI/CD Gate, Seal & Origin Push**
  - Scripts: `scripts/tip-refresh.mjs`, `scripts/verify-fast.mjs`, pre-push 7-stage CI/CD gate.
  - Done Criteria: Freeze pin sealed, commits pushed to `origin/main`.
