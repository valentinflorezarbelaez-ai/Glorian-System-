# PLAN-173: Architecture & Technical Plan (`SPEC-311` — Shared-Memory Workers & Jepsen WAL Recovery)

## 1. Architectural Decisions (`ADR-173`)

### Decision

1. Move SIMD128 iteration inside a single W3C WebAssembly loop export (`simd_i32x4_max_join_loop`) in `src/core/eosWasmSimd128VectorArena.ts` to eliminate JS $\leftrightarrow$ WASM crossing overhead.
2. Build `EosSharedMemoryWorkerPoolCore` over Node.js built-in `node:worker_threads`, `WebAssembly.Memory({ shared: true })` (`SharedArrayBuffer`), `Atomics`, `node:sqlite`, and `node:child_process`.
3. Harden `.github/workflows/eos-sovereign-cicd.yml` so `refs/heads/main` builds are never canceled mid-flight and JS actions opt into Node 24.

### Rejected Alternatives

- **Message-passing JSON copies between workers**: Rejected because structured cloning copies heap objects instead of operating zero-copy over shared `WebAssembly.Memory`.
- **Single-process SQLite rollback simulation only**: Rejected because real OS process boundary crash drills validate filesystem WAL sync and recovery guarantees.
