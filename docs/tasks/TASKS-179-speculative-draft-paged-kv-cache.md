# TASKS-179: Implementation Task DAG for Speculative Multi-Token Draft Verification & Paged KV-Cache Attention Engine

**Tasks ID**: TASKS-179  
**Specification**: SPEC-317  
**Change Proposal**: CHANGE-179  
**Domain**: Neural Inference Optimization, Virtual Memory Page Tables, Speculative Decoding

---

## 1. Task Dependency Graph (DAG)

```
[Task 1: Intake, Change, Spec, Plan, Auth]
                    |
                    v
[Task 2: TLA+ Formal Model 61 & TLC Verification]
                    |
                    v
[Task 3: Domain Types & Core Engine Implementation]
                    |
                    v
[Task 4: CLI Command Dispatcher (508 -> 513 commands)]
                    |
                    v
[Task 5: BDD Test Suite & Cryptographic Receipt Generation]
                    |
                    v
[Task 6: Tip-Refresh, Pre-Commit Fast Lane, Release Seal & Push]
```

---

## 2. Atomic Tasks Definition

- [x] **Task 1: Requirements Engineering & Formal Authorization**
  - Define `INTAKE-179-SPECULATIVE-DRAFT-PAGED-KV-CACHE.md`.
  - Author `CHANGE-179-speculative-draft-paged-kv-cache.md`.
  - Author `SPEC-317-speculative-draft-paged-kv-cache.md` (FR-1..6, BDD-1677..1682).
  - Author `PLAN-179-speculative-draft-paged-kv-cache.md` (ADR-179-001..003).
  - Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.

- [ ] **Task 2: TLA+ Formal Verification (Model 61)**
  - Author `docs/formal/SpeculativePagedKvCache.tla` and `docs/formal/SpeculativePagedKvCache.cfg`.
  - Model page table block allocation, free list conservation, and speculative acceptance.
  - Register in `scripts/run-tlc.mjs` and execute live TLC model checker.
  - Verify 0 invariant violations across all states.

- [ ] **Task 3: Domain Types & Core Engine Implementation**
  - Author `src/core/eosSpeculativePagedKvCache.types.ts`.
  - Author `src/core/eosSpeculativePagedKvCache.ts` (`EosSpeculativePagedKvCacheCore`).
  - Implement Paged KV-Cache virtual memory manager with block pool and page tables.
  - Implement speculative candidate draft generator and parallel target verifier.
  - Implement memory invariant auditing and SHA-256 receipt generation.
  - Export in `src/core/index.ts` maintaining $\le 800$ lines with $\ge 12$ lines headroom.

- [ ] **Task 4: Toolchain CLI Dispatcher (508 -> 513 commands, 100% Parity)**
  - Author `bin/commands/cliSpeculativePagedKvCache.mjs` implementing:
    - `toolchain:speculative:pagetable`: Inspect page table and fragmentation index.
    - `toolchain:speculative:allocate`: Allocate/extend blocks for a sequence.
    - `toolchain:speculative:draft`: Generate speculative candidate tokens.
    - `toolchain:speculative:verify`: Parallel verification with acceptance telemetry.
    - `toolchain:speculative:audit`: Invariant audit with signed receipt.
  - Ensure all commands return `true` for pure `--json` output.
  - Wire into `bin/commands/cliToolchainRouter.mjs`.
  - Register 5 commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md`.
  - Verify with `node bin/eos.mjs hygiene:audit --json` -> `HYGIENE_GOVERNED`.

- [ ] **Task 5: BDD Test Suite & Cryptographic Receipt**
  - Author `test/eosSpeculativePagedKvCache.test.mjs` covering `BDD-1677`..`BDD-1682`.
  - Execute test suite and verify 6/6 pass.
  - Emit `docs/evidence/SPECULATIVE_PAGED_KV_CACHE_RECEIPT.json`.
  - Update `docs/quality/coverage-budget.json`.

- [ ] **Task 6: Verification, Tip-Refresh, Commit, Seal & Remote Push**
  - Run `node scripts/tip-refresh.mjs` and format docs with Prettier.
  - Run `node scripts/verify-fast.mjs`.
  - Commit feature (`SPEC-317 / CHANGE-179`).
  - Run `node scripts/tip-refresh.mjs --seal-pin`.
  - Format `EOS_FREEZE_GATE_STATUS.md` and commit seal.
  - Push to `origin/main` passing the 7-stage pre-push gate.
