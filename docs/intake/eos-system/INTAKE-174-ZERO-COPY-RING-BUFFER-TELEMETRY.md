# INTAKE-174 — Zero-Copy Circular Ring-Buffer Telemetry & OTLP Streaming Bridge

- **Specification Target**: `SPEC-312` / `CHANGE-174`
- **Owner**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-11-16
- **Component**: `eos-system-control-plane` (`src/core/eosZeroCopyRingBuffer.ts`)

---

## 1. Context & Motivation

Following the implementation of `SPEC-310` (WebAssembly SIMD128 Vector Arena) and `SPEC-311` (Shared-Memory Worker Pool & Multi-Process SQLite WAL Jepsen Recovery), high-throughput computation kernels emit massive telemetry streams (metrics, spans, events) across multi-core worker threads.

In high-concurrency environments, emitting telemetry via conventional JSON/object passing incurs:

1. Continuous JavaScript heap allocations causing V8 Garbage Collection (GC) pauses.
2. Serialization/deserialization overhead across Worker thread boundaries.
3. Cache-line contention (false sharing) between producer and consumer CPU cores.

Distinguished systems engineers (Jane Street, Oxide, Cloudflare) mandate lock-free, zero-allocation ring buffers in shared memory (`SharedArrayBuffer` / `WebAssembly.Memory`) with cache-line padded sequencers and bitwise power-of-2 index masking.

---

## 2. Inviolable Architectural Constraints

1. **Zero External Runtime Dependencies**: `dependencies: {}` in `package.json` (Constitutional Law V).
2. **Strict Module Size & Headroom**: $\le 800$ lines per file with $\ge 12$ lines headroom (SPEC-250).
3. **Formal Verification (TLA+)**: Formal mathematical model in `docs/formal/ZeroCopyRingBuffer.tla` verified with Leslie Lamport's TLC model checker.
4. **Mechanical Sympathy**: 64-byte cache-line aligned header and 64-byte fixed-size slots to prevent false sharing.
5. **Pure CLI `--json` Output**: All subcommands return `true` with zero trailing banners.
6. **100% CLI Catalog Parity**: Registered in `cliHelpCatalog.mjs` and `DEVELOPER_GUIDE.md`.

---

## 3. Scope of Delivery

- EARS Functional Requirements & BDD Scenarios (`BDD-1647`..`BDD-1652`).
- TLA+ model `ZeroCopyRingBuffer.tla` and configuration `ZeroCopyRingBuffer.cfg`.
- TypeScript domain engine `src/core/eosZeroCopyRingBuffer.ts` and types `src/core/eosZeroCopyRingBuffer.types.ts`.
- CLI commands `toolchain:ringbuffer:create`, `toolchain:ringbuffer:push`, `toolchain:ringbuffer:drain`, `toolchain:ringbuffer:benchmark`, `toolchain:ringbuffer:audit`.
- Signed cryptographic evidence receipt `docs/evidence/ZERO_COPY_RING_BUFFER_RECEIPT.json`.
