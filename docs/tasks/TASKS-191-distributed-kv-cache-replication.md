# TASKS-191: Distributed Key-Value Cache Replication, Prefix Caching & Speculative KV Prefetching Engine

**Reference**: `SPEC-329` / `CHANGE-191`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-191-1: Formal TLA+ Model 73]
         |
         v
[TASK-191-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-191-3: CLI Dispatcher]   [TASK-191-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-191-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [x] **TASK-191-1: Formal TLA+ Model 73**
  - File: `docs/formal/DistributedKvCacheReplication.tla` & `DistributedKvCacheReplication.cfg`
  - Invariants: `TypeOK`, `MemoryCeilingBounded`, `PinnedImmunity`, `PrefixConsistency`, `ReplicationIntegrity`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [x] **TASK-191-2: Core Domain Types & Engine**
  - Files: `src/core/eosDistributedKvReplication.types.ts`, `src/core/eosDistributedKvReplication.ts`
  - Class: `EosDistributedKvReplicationCore`
  - Methods:
    - `insertPrefix(tokens, kvData, isPinned)`
    - `matchPrefix(tokens)`
    - `replicateBlock(blockId, targetWorkerId)`
    - `speculativePrefetch(candidates, activeBuffer)`
    - `evictBlocks(count)`
    - `audit(numWorkers, numSessions, blockCapacity)`
  - Done Criteria: Typecheck clean, exported in `src/core/index.ts` with $\le 800$ lines, headroom $\ge 12$ lines.

- [x] **TASK-191-3: CLI Dispatcher & Router Parity (568 -> 573)**
  - File: `bin/commands/cliDistributedKvReplication.mjs`
  - Commands: `toolchain:kvcache:prefix`, `toolchain:kvcache:replicate`, `toolchain:kvcache:prefetch`, `toolchain:kvcache:evict`, `toolchain:kvcache:audit`.
  - Router: `bin/commands/cliToolchainRouter.mjs`
  - Catalog: `bin/commands/cliHelpCatalog.mjs`
  - Guide: `docs/DEVELOPER_GUIDE.md`
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` passes with `HYGIENE_GOVERNED`.

- [x] **TASK-191-4: BDD Test Suite & Coverage Budget**
  - File: `test/eosDistributedKvReplication.test.mjs`
  - Coverage: `docs/quality/coverage-budget.json` (lines: 80.0%, branches: 70.0%)
  - Evidence: `docs/evidence/DISTRIBUTED_KV_CACHE_REPLICATION_RECEIPT.json`
  - Done Criteria: 7/7 BDD tests passing (BDD-1749..1754).

- [x] **TASK-191-5: CI/CD Gate, Seal & Origin Push**
  - Execute: `node scripts/verify-fast.mjs`
  - Commit: Conventional commit with signed freeze pin seal
  - Push: Clean synchronization to `origin/main`.
