# CHANGE-217: Deterministic Zero-Copy Shared Memory Inter-Process Ring Buffer (IPC) Architecture

## 1. Proposal Overview

- **Change ID**: `CHANGE-217`
- **Specification ID**: `SPEC-355`
- **Ladder Stage**: `LADDER-13`
- **Domain**: High-Performance IPC, Shared Memory Systems & Real-Time Agent Communication
- **Architectural Reference**: Martin Thompson (LMAX Disruptor), Leslie Lamport (Memory Fences & Sequential Consistency), Jane Street (Sub-Microsecond Systems)

---

## 2. Intent & Motivation

Enable sub-microsecond, zero-heap-allocation, lock-free inter-process communication across Glorian worker threads, background agents, and control plane daemons. Replaces JSON IPC strings with fixed-slot binary frames over `SharedArrayBuffer` using `Atomics` memory fences.

---

## 3. Scope of Implementation

1. **Core Type System**:
   - `src/core/eosZeroCopyIpcRingBuffer.types.ts`: Define ring buffer header, binary frame layout, sequence cursors, atomic wait strategies, and formal receipt types.
2. **Core Domain Module**:
   - `src/core/eosZeroCopyIpcRingBuffer.ts`:
     - `EosZeroCopyIpcHeader`: Cache-line padded header with atomic head/tail pointers and power-of-2 capacity.
     - `EosBinaryFrameCodec`: 20-byte fixed header encoder/decoder with CRC32 integrity verification.
     - `EosZeroCopyIpcRingBuffer`: Core ring buffer implementation supporting SPSC and MPSC lock-free operations.
     - `EosZeroCopyIpcGovernor`: Automated benchmark, verification receipt generator, and audit driver.
3. **Formal Verification (TLA+ Model 98)**:
   - `docs/formal/ZeroCopyIpcRingBuffer.tla` and `docs/formal/ZeroCopyIpcRingBuffer.cfg`.
4. **CLI & Toolchain Router**:
   - `bin/commands/cliZeroCopyIpcRingBuffer.mjs` registering `toolchain:ipc:write`, `toolchain:ipc:read`, `toolchain:ipc:bench`, and `toolchain:ipc:audit`.
   - Wiring in `bin/commands/cliToolchainRouter.mjs` and `bin/commands/cliHelpCatalog.mjs`.
5. **Phase 8 MCP Tool**:
   - `eos_zero_copy_ipc_audit` in `src/core/eosMcpToolTaxonomy.ts`, definitions, handlers, and catalog.
6. **Automated Test Suite**:
   - `test/eosZeroCopyIpcRingBuffer.test.mjs` verifying `BDD-1909`..`BDD-1914`.
