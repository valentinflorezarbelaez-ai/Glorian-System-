# TASKS-192: Tree-Structured Speculative Decoding, Multi-Candidate Rejection Sampling & Dynamic Draft-Target Verification Engine

**Reference**: `SPEC-330` / `CHANGE-192`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-192-1: Formal TLA+ Model 74]
         |
         v
[TASK-192-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-192-3: CLI Dispatcher]   [TASK-192-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-192-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [x] **TASK-192-1: Formal TLA+ Model 74**
  - File: `docs/formal/TreeSpeculativeDecoding.tla` & `TreeSpeculativeDecoding.cfg`
  - Invariants: `TypeOK`, `TreeMaskAncestry`, `GuaranteedProgress`, `DistributionalFidelity`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [x] **TASK-192-2: Core Domain Types & Engine**
  - Files: `src/core/eosTreeSpeculativeDecoding.types.ts`, `src/core/eosTreeSpeculativeDecoding.ts`
  - Class: `EosTreeSpeculativeDecodingCore`
  - Methods:
    - `buildDraftTree(rootTokenId, branchingConfig)`
    - `synthesizeTreeAttentionMask(tree)`
    - `verifyTreeWithRejectionSampling(tree, targetProbabilities, draftProbabilities, rng)`
    - `selectLongestAcceptedPath(tree, verificationResults)`
    - `adaptTreeTopology(currentConfig, historicalAlpha)`
    - `audit(vocabSize, treeDepth, branchingFactor)`
  - Done Criteria: Typecheck clean, exported in `src/core/index.ts` with $\le 800$ lines, headroom $\ge 12$ lines.

- [x] **TASK-192-3: CLI Dispatcher & Router Parity (573 -> 578)**
  - File: `bin/commands/cliTreeSpeculativeDecoding.mjs`
  - Commands: `toolchain:specdec:draft`, `toolchain:specdec:mask`, `toolchain:specdec:verify`, `toolchain:specdec:speedup`, `toolchain:specdec:audit`.
  - Router: `bin/commands/cliToolchainRouter.mjs`
  - Catalog: `bin/commands/cliHelpCatalog.mjs`
  - Guide: `docs/DEVELOPER_GUIDE.md`
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` passes with `HYGIENE_GOVERNED`.

- [x] **TASK-192-4: BDD Test Suite & Coverage Budget**
  - File: `test/eosTreeSpeculativeDecoding.test.mjs`
  - Coverage: `docs/quality/coverage-budget.json` (lines: 80.0%, branches: 70.0%)
  - Evidence: `docs/evidence/TREE_SPECULATIVE_DECODING_RECEIPT.json`
  - Done Criteria: 7/7 BDD tests passing (BDD-1755..1760).

- [x] **TASK-192-5: CI/CD Gate, Seal & Origin Push**
  - Execute: `node scripts/verify-fast.mjs`
  - Commit: Conventional commit with signed freeze pin seal
  - Push: Clean synchronization to `origin/main`.
