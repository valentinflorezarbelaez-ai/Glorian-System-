# PLAN-217: Architecture Plan for Deterministic Zero-Copy Shared Memory Ring Buffer (IPC)

## 1. Architectural Overview & Context

- **Spec / Change**: `SPEC-355` / `CHANGE-217`
- **Domain**: Low-Latency Systems, Inter-Process Communication, Shared Memory Concurrency
- **Archetype**: LMAX Disruptor (Thompson), HFT Kernel-Bypass Memory Ring Buffers (Jane Street), Leslie Lamport (Sequential Consistency & Atomics)

---

## 2. Architecture Decisions (ADRs)

### ADR-217-001: Zero-Copy SharedArrayBuffer Atomic Ring Buffer Framing

- **Status**: `APPROVED`
- **Context**: Inter-process message passing in Node.js via standard IPC or Unix domain sockets introduces string encoding/decoding overhead and garbage collector pressure.
- **Decision**: Allocate a contiguous `SharedArrayBuffer` holding a 128-byte cache-line aligned atomic control header and a ring of fixed-size slots. Use `BigInt64Array` and `Int32Array` views with `Atomics` memory fences.
- **Consequences**: Zero heap string allocations during message passing. Direct memory sharing across threads and processes.

### ADR-217-002: Lock-Free Single-Producer Multi-Consumer (SPMC) & MPSC Sequence Memory Ordering

- **Status**: `APPROVED`
- **Context**: Locking mutexes in high-frequency trading and high-throughput agent loops induces kernel transitions and tail latency spikes.
- **Decision**: Implement lock-free sequence coordination using `Atomics.load`, `Atomics.store`, and `Atomics.compareExchange`. Producer writes data into slot `seq & mask`, followed by an atomic store release of `headSequence`. Consumer polls `tailSequence` up to `headSequence` using atomic load acquire.
- **Consequences**: Completely lock-free execution path. Predictable sub-microsecond latency.

---

## 3. Memory Layout Blueprint

```text
+---------------------------------------------------------------------------------------+
| SHARED ARRAY BUFFER LAYOUT (Power of 2: Capacity C, Slot Size S)                      |
+---------------------------------------------------------------------------------------+
| Offset 0..63   (64B): Producer Sequencer (headSequence: int64, padding to 64 bytes)    |
| Offset 64..127 (64B): Consumer Sequencer (tailSequence: int64, padding to 64 bytes)    |
+---------------------------------------------------------------------------------------+
| SLOTS ARENA: Slot 0 .. Slot (C - 1)                                                   |
| Each Slot:                                                                            |
|   + 0..1   (2B): Magic Bytes (0x454F -> 'EO')                                         |
|   + 2..3   (2B): Message Type ID (uint16)                                             |
|   + 4..11  (8B): Monotonic Frame Sequence (uint64)                                    |
|   + 12..15 (4B): Payload Length in bytes (uint32)                                     |
|   + 16..19 (4B): CRC-32 Checksum (uint32)                                            |
|   + 20..S  (Payload Data Bytes)                                                       |
+---------------------------------------------------------------------------------------+
```
