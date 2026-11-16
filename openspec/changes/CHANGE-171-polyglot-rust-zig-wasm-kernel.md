# CHANGE-171: Polyglot Rust & Zig Native WebAssembly Linear-Memory Kernel Engine

## Metadata

- **Change ID**: `CHANGE-171`
- **Specification**: `SPEC-309`
- **Scope**: Polyglot Rust/Zig WASM Compiler & Hardware-Isolated Execution Engine (`src/core/eosPolyglotRustZigWasmKernel.ts`) + Cross-Platform CI Hardening (`eosNativeSqliteStore.ts`, `eosHelmReleaseGovernor.ts`)
- **Status**: `PROPOSED` -> `AUTHORIZED`
- **Classification**: High-Performance Polyglot Systems / Rust `#![no_std]` / Zig / WebAssembly Linear Memory / Zero Dependencies

## 1. Intent & Context

Bridge sovereign TypeScript orchestration in Glorian System with real **Rust `#![no_std]`** and **Zig `wasm32-freestanding`** compute kernels running inside hardware-isolated `WebAssembly.Memory` linear arenas (`SPEC-309`), and wire `EosCrdtStateReplicatorCore` (`SPEC-308`) to execute distributed vector joins through this WASM arena by default.

Concurrently, harden two cross-platform CI matrix edge cases identified in GitHub Actions:

- Pure Layer-0 SQLite lexical fallback in `EosNativeSqliteStore` when Node 23 environments omit SQLite's `fts5` virtual table module.
- Pure Layer-0 Helm chart structure and manifest templating fallback in `EosHelmReleaseGovernor` when CI Windows runners omit `helm` from `PATH`.

## 2. Technical Scope

1. **Canonical Polyglot Sources**:
   - `templates/polyglot-wasm/kernel.rs`: `rust_crdt_vector_join` and `rust_fnv1a32`.
   - `templates/polyglot-wasm/kernel.zig`: `zig_fnv1a32_hash` and `zig_ring_buffer_free_slots`.
2. **Polyglot Compiler & Execution Core (`EosPolyglotRustZigWasmKernelCore`)**:
   - `compilePolyglotKernel(language, projectRoot?)`: Inspects Rust/Zig source, attempts native `wasm32` compilation or deterministic hermetic W3C WASM bytecode synthesis (`SPEC-306`), validates W3C `\0asm\x01\x00\x00\x00` header, and seals SHA-256 digest.
   - `executeRustVectorJoinWasm(vecA, vecB)`: Allocates hardware-isolated `WebAssembly.Memory(1)` arena, maps contiguous `Int32Array` slices, invokes a compiled `WebAssembly.Instance` kernel over linear memory, and returns element-wise join and timing telemetry in nanoseconds.
   - `executeZigFnv1aHashWasm(input)`: Computes canonical 32-bit FNV-1a (`0x811c9dc5`, `0x01000193`) inside WASM linear memory.
   - `executeZigRingBufferCheckWasm(producerSeq, consumerSeq, capacity)`: Computes lock-free ring-buffer free slots, utilization ratio, and backpressure state inside WASM linear memory.
   - `benchmarkPolyglotWasm(dimension?, iterations?)`: Benchmarks WASM linear-memory vs JS array execution and proves 100% deterministic equivalence.
   - `auditPolyglotRustZigPipeline(projectRoot?)`: Runs full end-to-end verification and emits signed receipt `docs/evidence/POLYGLOT_RUST_ZIG_WASM_RECEIPT.json`.
3. **Active Control-Plane Consumer**:
   - Wire `EosPolyglotRustZigWasmKernelCore.executeRustVectorJoinWasm` directly into `EosCrdtStateReplicatorCore.mergeLinearMemoryVectors` (`SPEC-308`).
4. **CLI Parity (`471 -> 475`)**:
   - Register `toolchain:rustzig:compile`, `toolchain:rustzig:execute`, `toolchain:rustzig:benchmark`, `toolchain:rustzig:audit`.
