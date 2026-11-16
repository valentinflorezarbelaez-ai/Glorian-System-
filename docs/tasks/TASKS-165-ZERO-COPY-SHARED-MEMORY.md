# TASKS-165: Zero-Copy Shared Memory Arena (SharedArrayBuffer + Atomics)

- **Tasks ID**: `TASKS-165`
- **Change ID**: `CHANGE-165`
- **Spec Reference**: `SPEC-303`
- **Tier**: Low-Latency Concurrency, Off-Heap Memory Arenas & Lock-Free IPC (Phase 4.4)
- **Status**: `READY`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T09:51:00Z

---

## Task Dependency Graph (DAG)

```text
[TASK-165-01: Types Definition]
       │
       ▼
[TASK-165-02: Core Shared Memory Arena Implementation]
       │
       ▼
[TASK-165-03: Core Re-export & Typecheck]
       │
       ▼
[TASK-165-04: CLI Subdispatcher Implementation]
       │
       ▼
[TASK-165-05: CLI Router, Catalog & Developer Guide Registration]
       │
       ▼
[TASK-165-06: Test Suite (BDD-1593..BDD-1598)]
       │
       ▼
[TASK-165-07: Tip Refresh & Pre-Push Gate Sealing]
```

---

## Detailed Task Breakdown

### TASK-165-01: Types Definition

- Create `src/core/eosSharedMemoryArena.types.ts`.
- Define `SharedMemoryArenaConfig`, `SharedMemoryHeader`, `SharedMemoryStats`, `EnqueueResult`, `DequeueResult`, `SharedMemoryAuditReceipt`.

### TASK-165-02: Core Shared Memory Arena Implementation

- Create `src/core/eosSharedMemoryArena.ts`.
- Implement `EosSharedMemoryArena`:
  - `createArena(capacityBytes)`: Allocates `SharedArrayBuffer` and formats 64-byte control header.
  - `fromSharedBuffer(buffer)`: Attaches typed views to existing `SharedArrayBuffer` with magic signature validation.
  - `enqueue(payload, flags)`: Zero-copy lock-free write into circular slab with wrap-around and `Atomics.notify`.
  - `dequeue()`: Zero-copy read returning sliced `Uint8Array` view and advancing head pointer.
  - `getStats()`: Atomic snapshot of capacity, usage, read/write sequences, and dropped messages.
  - `auditSharedMemoryPipeline(options)`: Writes `docs/evidence/SHARED_MEMORY_RECEIPT.json`.

### TASK-165-03: Core Re-export & Typecheck

- Export in `src/core/index.ts`.
- Run `npm run typecheck` to verify 0 errors.

### TASK-165-04: CLI Subdispatcher Implementation

- Create `bin/commands/cliSharedMemory.mjs`.
- Implement subcommands: `toolchain:shm:alloc`, `toolchain:shm:produce`, `toolchain:shm:consume`, `toolchain:shm:audit`.

### TASK-165-05: CLI Router, Catalog & Developer Guide Registration

- Update `bin/commands/cliToolchainRouter.mjs`.
- Register 4 commands in `bin/commands/cliHelpCatalog.mjs`.
- Add documentation in `docs/DEVELOPER_GUIDE.md`.
- Verify 100.00% parity with `node bin/eos.mjs hygiene:audit`.

### TASK-165-06: Test Suite (BDD-1593..BDD-1598)

- Create `test/eosSharedMemoryArena.test.mjs`.
- Test all 6 BDD scenarios.
- Run `node --test test/eosSharedMemoryArena.test.mjs` and confirm 100% pass.

### TASK-165-07: Tip Refresh & Pre-Push Gate Sealing

- Run `node scripts/tip-refresh.mjs`.
- Stage, commit, seal pin, and push to `origin/main`.
