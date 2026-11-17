# TASKS-186: ZeRO (Zero Redundancy Optimizer) & Fully Sharded Data Parallel (FSDP) Engine

**Reference**: `SPEC-324` / `CHANGE-186`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-186-1: Formal TLA+ Model 68]
         |
         v
[TASK-186-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-186-3: CLI Dispatcher]   [TASK-186-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-186-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [x] **TASK-186-1: Formal TLA+ Model 68**
  - File: `docs/formal/ZeroFsdpEngine.tla` & `ZeroFsdpEngine.cfg`
  - Invariants: `TypeOK`, `MemoryCeilingBounded`, `ParameterConservation`, `ZeroLeakage`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [ ] **TASK-186-2: Core Domain Types & Engine**
  - Files: `src/core/eosZeroFsdpEngine.types.ts`, `src/core/eosZeroFsdpEngine.ts`
  - Class: `EosZeroFsdpCore`
  - Methods: `partitionOptimizerStates`, `stepZeRO1`, `stepZeRO2`, `stepZeRO3`, `offloadToHost`, `audit`.
  - Done Criteria: Exported in `src/core/index.ts`, 100% type-safe via `tsc`.

- [ ] **TASK-186-3: CLI Dispatcher & Router Parity**
  - File: `bin/commands/cliZeroFsdpEngine.mjs`
  - Commands: `toolchain:zero:stage1`, `toolchain:zero:stage2`, `toolchain:zero:stage3`, `toolchain:zero:offload`, `toolchain:zero:audit`.
  - Registered in `cliHelpCatalog.mjs`, `cliToolchainRouter.mjs`, `docs/DEVELOPER_GUIDE.md`.
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` reports `HYGIENE_GOVERNED` (548/548).

- [ ] **TASK-186-4: BDD Test Suite**
  - File: `test/eosZeroFsdpEngine.test.mjs`
  - Scenarios: `BDD-1719`..`BDD-1724`
  - Done Criteria: 6/6 tests passing, receipt in `docs/evidence/ZERO_FSDP_RECEIPT.json`.

- [ ] **TASK-186-5: CI/CD Gate, Seal & Origin Push**
  - Tip-refresh, Prettier formatting, `scripts/verify-fast.mjs`.
  - Commit, seal freeze pin, test doc consistency, git push through 7-stage gate to `origin/main`.
