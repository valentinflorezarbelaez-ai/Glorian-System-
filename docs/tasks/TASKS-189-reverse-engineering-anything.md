# TASKS-189: Universal Reverse Engineering Anything (REA) Engine

**Reference**: `SPEC-327` / `CHANGE-189`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-189-1: Formal TLA+ Model 71]
         |
         v
[TASK-189-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-189-3: CLI Dispatcher]   [TASK-189-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-189-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [ ] **TASK-189-1: Formal TLA+ Model 71**
  - File: `docs/formal/ReverseEngineeringEngine.tla` & `ReverseEngineeringEngine.cfg`
  - Invariants: `TypeOK`, `ConservationOfBlocks`, `AcyclicCFGSafety`, `ZeroHostContamination`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [ ] **TASK-189-2: Core Domain Types & Engine**
  - Files: `src/core/eosReverseEngineeringEngine.types.ts`, `src/core/eosReverseEngineeringEngine.ts`
  - Class: `EosReverseEngineeringCore`
  - Methods:
    - `detectTargetFormat(buffer)`
    - `unpackAsar(buffer)`
    - `analyzeJsBundle(sourceCode)`
    - `extractSymbols(buffer, format)`
    - `computeSectionEntropy(buffer)`
    - `recoverControlFlowGraph(instructions)`
    - `audit(syntheticPayloads)`
  - Done Criteria: Typecheck clean, exported in `src/core/index.ts` with $\le 800$ lines, headroom $\ge 12$ lines.

- [ ] **TASK-189-3: CLI Dispatcher & Router Parity (558 -> 563)**
  - File: `bin/commands/cliReverseEngineeringEngine.mjs`
  - Commands: `toolchain:rea:detect`, `toolchain:rea:unpack`, `toolchain:rea:entropy`, `toolchain:rea:cfg`, `toolchain:rea:audit`.
  - Router: `bin/commands/cliToolchainRouter.mjs`
  - Catalog: `bin/commands/cliHelpCatalog.mjs`
  - Guide: `docs/DEVELOPER_GUIDE.md`
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` passes with `HYGIENE_GOVERNED`.

- [ ] **TASK-189-4: BDD Test Suite & Coverage Budget**
  - File: `test/eosReverseEngineeringEngine.test.mjs`
  - Coverage: `docs/quality/coverage-budget.json` (lines: 80.0%, branches: 70.0%)
  - Evidence: `docs/evidence/REVERSE_ENGINEERING_RECEIPT.json`
  - Scenarios: `BDD-1737`..`BDD-1742` (6/6 passing).

- [ ] **TASK-189-5: CI/CD Gate, Seal & Origin Push**
  - Linear rebase on `origin/main`.
  - Pass 7-stage pre-push CI/CD gate.
  - Seal freeze pin to HEAD.
  - Engram observation recorded.
