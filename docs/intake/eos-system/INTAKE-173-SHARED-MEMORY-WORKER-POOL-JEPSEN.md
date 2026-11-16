# INTAKE-173: Shared-Memory Worker Pool, In-WASM SIMD128 Loops & Multi-Process SQLite WAL Crash Recovery (`SPEC-311`)

## 1. Context & Problem Statement

Following `SPEC-310` (`CHANGE-172`), Distinguished / Principal Engineering review identified four concrete systems upgrades:

1. **In-WASM SIMD128 Vector Loops**: Moving the element iteration inside WebAssembly (`simd_i32x4_max_join_loop` using `block`/`loop`/`br_if` and `i32x4.max_s` / `i32x4.add`) eliminates per-chunk JS $\leftrightarrow$ WASM trampoline calls (`~474 ns/op -> ~2-4 ns/op`).
2. **True Shared-Memory Multi-Core Worker Pool (`WebAssembly.Memory({ shared: true })`)**: Coordinating Node.js `worker_threads` over `SharedArrayBuffer` via `Atomics.add`, `Atomics.compareExchange`, and `Atomics.notify` enables lock-free parallel reductions and sharded fleet audits.
3. **Real Multi-Process Crash Recovery (Cloudflare / Jepsen Standard)**: Verifying SQLite WAL + Merkle-CRDT durability across abrupt OS child-process termination mid-transaction with zero committed data loss (`4/4`) and zero uncommitted dirty leaks (`0`).
4. **CI Concurrency & Node 24 Action Hardening**: Guarding `main` against mid-flight workflow cancellations and forcing JS GitHub Actions to run cleanly on Node 24.

## 2. Requested Elevation

Deliver `SPEC-311` (`CHANGE-173`) spanning `src/core/eosWasmSimd128VectorArena.ts`, `src/core/eosSharedMemoryWorkerPool.types.ts`, `src/core/eosSharedMemoryWorkerPool.ts`, `.github/workflows/eos-sovereign-cicd.yml`, CLI subcommands `toolchain:workers:*` (`479 -> 483`), tests `BDD-1641..1646`, and signed evidence at `docs/evidence/SHARED_MEMORY_WORKER_POOL_RECEIPT.json`.
