# TASKS-193: StreamingLLM, Attention Sinks & Infinite-Context Window Memory Compression Engine

**Reference**: `SPEC-331` / `CHANGE-193`  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## Task Dependency Graph (DAG)

```
[TASK-193-1: Formal TLA+ Model 75]
         |
         v
[TASK-193-2: Core Domain Types & Engine]
         |
         +-----------------------+
         |                       |
         v                       v
[TASK-193-3: CLI Dispatcher]   [TASK-193-4: BDD Test Suite]
         |                       |
         +-----------------------+
         |
         v
[TASK-193-5: CI/CD Gate, Seal & Origin Push]
```

---

## Detailed Task Breakdown

- [ ] **TASK-193-1: Formal TLA+ Model 75**
  - File: `docs/formal/StreamingLlmAttentionSinks.tla` & `StreamingLlmAttentionSinks.cfg`
  - Invariants: `TypeOK`, `SinkPreservation`, `MemoryBoundInvariant`, `MonotonicPositionalOrdering`.
  - Done Criteria: Verified with Leslie Lamport's TLC model checker.

- [ ] **TASK-193-2: Core Domain Types & Engine**
  - Files: `src/core/eosStreamingLlmAttentionSinks.types.ts`, `src/core/eosStreamingLlmAttentionSinks.ts`
  - Class: `EosStreamingLlmCore`
  - Methods:
    - `ingestTokens(tokenSequence)`
    - `evictAndRollWindow(newToken)`
    - `computeDynamicRopePositions()`
    - `calculateAttentionScores(query)`
    - `measurePerplexityStability()`
    - `audit(streamLength, sinkSize, windowSize)`
  - Done Criteria: Typecheck clean, exported in `src/core/index.ts` with $\le 800$ lines, headroom $\ge 12$ lines.

- [ ] **TASK-193-3: CLI Dispatcher & Router Parity (578 -> 583)**
  - File: `bin/commands/cliStreamingLlmAttentionSinks.mjs`
  - Commands: `toolchain:streamllm:sink`, `toolchain:streamllm:window`, `toolchain:streamllm:rope`, `toolchain:streamllm:evict`, `toolchain:streamllm:audit`.
  - Router: `bin/commands/cliToolchainRouter.mjs`
  - Catalog: `bin/commands/cliHelpCatalog.mjs`
  - Guide: `docs/DEVELOPER_GUIDE.md`
  - Done Criteria: `node bin/eos.mjs hygiene:audit --json` passes with `HYGIENE_GOVERNED`.

- [ ] **TASK-193-4: BDD Test Suite & Coverage Budget**
  - File: `test/eosStreamingLlmAttentionSinks.test.mjs`
  - Coverage: `docs/quality/coverage-budget.json` (lines: 80.0%, branches: 70.0%)
  - Evidence: `docs/evidence/STREAMING_LLM_ATTENTION_SINKS_RECEIPT.json`
  - Done Criteria: 7/7 BDD tests passing (BDD-1761..1766).

- [ ] **TASK-193-5: CI/CD Gate, Seal & Origin Push**
  - Execute: `node scripts/verify-fast.mjs`
  - Commit: Conventional commit with signed freeze pin seal
  - Push: Clean synchronization to `origin/main`.
