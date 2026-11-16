# CHANGE-173: Shared-Memory Worker Pool, In-WASM SIMD128 Loops & Multi-Process WAL Crash Recovery

## Metadata

- **Change ID**: `CHANGE-173`
- **Specification**: `SPEC-311`
- **Scope**: Single-Call In-WASM SIMD128 Loop (`eosWasmSimd128VectorArena.ts`), `SharedArrayBuffer` Worker Pool + Multi-Process WAL Jepsen Drill (`eosSharedMemoryWorkerPool.ts`), CI Workflow Hardening (`.github/workflows/eos-sovereign-cicd.yml`)
- **Status**: `PROPOSED` -> `AUTHORIZED`
- **Classification**: Multi-Core Shared Memory / WebAssembly Threads / Jepsen Crash Recovery / Zero Dependencies

## 1. Intent & Scope

1. Upgrade `EosWasmSimd128VectorArenaCore` with `simd_i32x4_max_join_loop` (`block`/`loop`/`br_if` inside W3C WebAssembly SIMD bytecode).
2. Implement `EosSharedMemoryWorkerPoolCore` with shared `WebAssembly.Memory` (`SharedArrayBuffer`), `worker_threads` lock-free reductions via `Atomics`, parallel sharded elastic fleet audit, and real multi-process SQLite WAL crash-recovery verification.
3. Harden `.github/workflows/eos-sovereign-cicd.yml` concurrency (`main` protected) and `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
4. Register `toolchain:workers:arena`, `toolchain:workers:reduce`, `toolchain:workers:jepsen`, `toolchain:workers:audit` (`479 -> 483` CLI parity).
