# PLAN-165: Zero-Copy Shared Memory Arena (SharedArrayBuffer + Atomics)

- **Plan ID**: `PLAN-165`
- **Change ID**: `CHANGE-165`
- **Spec Reference**: `SPEC-303`
- **Tier**: Low-Latency Concurrency, Off-Heap Memory Arenas & Lock-Free IPC (Phase 4.4)
- **Status**: `APPROVED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T09:51:00Z

---

## 1. Architectural Strategy & ADRs

### ADR-165-01: SharedArrayBuffer Layout & Off-Heap Memory Arena Architecture

- **Context**: Inter-thread communication via `postMessage` or IPC copies memory across thread heaps. In massive telemetry pipelines or AST analysis, copying 10MB arrays causes significant CPU cache thrashing and GC pauses.
- **Decision**: Pre-allocate a single contiguous `SharedArrayBuffer` with an explicit 64-byte atomic control header at offset 0 followed by the circular data slab:
  - Byte 0..3: `MAGIC` (`0x454F534D` - "EOSM").
  - Byte 4..7: `VERSION` (`1`).
  - Byte 8..11: `DATA_CAPACITY` (Uint32).
  - Byte 12..15: `HEAD_POINTER` (Uint32, atomic read offset).
  - Byte 16..19: `TAIL_POINTER` (Uint32, atomic write offset).
  - Byte 20..23: `WRITE_SEQ` (Uint32 monotonic write counter).
  - Byte 24..27: `READ_SEQ` (Uint32 monotonic read counter).
  - Byte 28..31: `DROPPED_MESSAGES` (Uint32 overflow counter).
  - Byte 32..63: Reserved for alignment & atomic flags.
  - Byte 64..N: Circular byte storage.
- **Alternatives Considered & Rejected**:
  - _Standard ArrayBuffer_: Cannot be mutated concurrently across threads without transfer/ownership revocation.
  - _Third-party native C++ addons (`node-mmap`, etc.)_: Violates **Law V** (zero runtime npm dependencies) and breaks cross-platform portability across Windows, Linux, and macOS.

### ADR-165-02: Lock-Free Single-Producer Single-Consumer (SPSC) Ring Buffer with Atomics

- **Context**: Thread locks (mutexes) in JavaScript runtimes cause context switches and thread stalling.
- **Decision**: Use pure `Atomics` primitives (`Atomics.load`, `Atomics.store`, `Atomics.add`, `Atomics.wait`, `Atomics.notify`) on an `Int32Array` view over the control header.
  - SPSC design guarantees that only the producer modifies `TAIL_POINTER` and `WRITE_SEQ`, and only the consumer modifies `HEAD_POINTER` and `READ_SEQ`.
  - Concurrency is 100% lock-free and wait-free on the happy path.

### ADR-165-03: Zero-Copy Serialization & Slab Allocation Protocol

- **Context**: Standard object serialization (`JSON.stringify`, `v8.serialize`) creates intermediate buffer copies.
- **Decision**: Frame messages with binary headers:
  - 4 bytes: `Payload Length` (Uint32).
  - 2 bytes: `Message Type / Flags` (Uint16).
  - 2 bytes: `Checksum / Reserved` (Uint16).
  - $N$ bytes: `Raw Payload`.
    Readers receive direct `Uint8Array` subarrays over the `SharedArrayBuffer` memory space, enabling zero-copy inspection in nanoseconds.

---

## 2. Component Layout & Module Structure

```text
src/core/
  ├── eosSharedMemoryArena.types.ts  (~110 lines) -> Control header, stats, options, receipt types
  └── eosSharedMemoryArena.ts        (~360 lines) -> SharedArrayBuffer allocator, Atomics ring buffer, zero-copy slicing

bin/commands/
  └── cliSharedMemory.mjs            (~160 lines) -> CLI subcommands (alloc, produce, consume, audit)

test/
  └── eosSharedMemoryArena.test.mjs  (~210 lines) -> Tests for BDD-1593..BDD-1598

docs/evidence/
  └── SHARED_MEMORY_RECEIPT.json     (~15 lines)  -> Verification receipt
```

---

## 3. Invariants & Guardrails

- **Law V**: Zero runtime third-party dependencies (`dependencies: {}`) using native JavaScript `SharedArrayBuffer` and `Atomics`.
- **SPEC-250**: Each module must strictly maintain $\le 800$ lines with $\ge 12$ lines of headroom.
- **Fail-Closed Verification**: Corrupted magic signature immediately throws `INVALID_ARENA_HEADER`.
