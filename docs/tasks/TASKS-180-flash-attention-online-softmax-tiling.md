# Tasks DAG: FlashAttention-Style Online Softmax Tiling & Block-Paged Attention Kernel

**Identifier**: `TASKS-180`
**Target Specification**: `SPEC-318`
**Target Change**: `CHANGE-180`
**Status**: `READY`
**Author**: Valentin Florez Arbelaez & Glorian / EOS Engineering Guild
**Date**: 2026-11-17

---

## 1. Dependency Graph (DAG)

```text
[Task 1: Model 62 TLA+ Formal Verification]
       │
       ▼
[Task 2: Core Domain Types (eosFlashAttentionOnlineSoftmax.types.ts)]
       │
       ▼
[Task 3: Core Domain Implementation (eosFlashAttentionOnlineSoftmax.ts)]
       │
       ▼
[Task 4: CLI Dispatcher & Router Parity (cliFlashAttentionOnlineSoftmax.mjs)]
       │
       ▼
[Task 5: BDD Test Suite & Cryptographic Receipt (BDD-1683..BDD-1688)]
       │
       ▼
[Task 6: Tip-Refresh, Prettier & Fast Pre-Commit Lane]
       │
       ▼
[Task 7: Linear Rebase, Freeze Pin Seal & Pre-Push CI/CD Deployment]
```

---

## 2. Atomic Task Breakdown

- [ ] **Task 1**: Author `docs/formal/FlashAttentionOnlineSoftmax.tla` & `.cfg`, register in `scripts/run-tlc.mjs`, and verify Model 62 with TLC model checker.
- [ ] **Task 2**: Create `src/core/eosFlashAttentionOnlineSoftmax.types.ts` defining contracts for tiles, running stats, config, and audit receipt.
- [ ] **Task 3**: Create `src/core/eosFlashAttentionOnlineSoftmax.ts` implementing `EosFlashAttentionOnlineSoftmaxCore`, export in `src/core/index.ts`, and run `tsc` typecheck.
- [ ] **Task 4**: Create `bin/commands/cliFlashAttentionOnlineSoftmax.mjs`, wire router in `bin/commands/cliToolchainRouter.mjs`, register in `bin/commands/cliHelpCatalog.mjs`, document in `docs/DEVELOPER_GUIDE.md`, and verify with `hygiene:audit`.
- [ ] **Task 5**: Create `test/eosFlashAttentionOnlineSoftmax.test.mjs`, add to coverage budget, execute test suite, and emit receipt.
- [ ] **Task 6**: Run `node scripts/tip-refresh.mjs`, format with Prettier, and run `verify-fast.mjs`.
- [ ] **Task 7**: Commit feature, seal freeze pin to HEAD, and push to `origin/main` passing the 7-stage pre-push gate.
