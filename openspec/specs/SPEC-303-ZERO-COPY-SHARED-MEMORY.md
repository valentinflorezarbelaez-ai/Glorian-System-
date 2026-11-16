# SPEC-303: Zero-Copy Shared Memory Arena (SharedArrayBuffer + Atomics)

- **Specification ID**: `SPEC-303`
- **Change ID**: `CHANGE-165`
- **Status**: `APPROVED`
- **Module**: `src/core/eosSharedMemoryArena.ts`
- **Tier**: Low-Latency Concurrency, Off-Heap Memory Arenas & Lock-Free IPC (Phase 4.4)
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-303-01 (Event-Driven Off-Heap Shared Memory Allocation)**: WHEN an arena is initialized with a requested byte capacity, THE SYSTEM SHALL allocate a `SharedArrayBuffer`, format a 64-byte atomic control header (Magic, Version, Capacity, Head, Tail, Sequences), and expose typed array views without intermediate heap copies.
- **FR-303-02 (State-Driven Lock-Free Zero-Copy Enqueue)**: MIENTRAS a producer writes data to the arena, THE SYSTEM SHALL write the framed message into the circular slab, advance the atomic tail pointer using `Atomics.store` or `Atomics.add`, and wake waiting consumers via `Atomics.notify`.
- **FR-303-03 (State-Driven Lock-Free Zero-Copy Dequeue)**: MIENTRAS a consumer reads from the arena, THE SYSTEM SHALL inspect the atomic head and tail pointers via `Atomics.load`, read the framed message in-place without object allocation, and update the atomic head pointer.
- **FR-303-04 (Error / Unwanted Condition: Ring Buffer Full & Overrun Tracking)**: SI the available free space in the circular buffer is insufficient for a message payload, ENTONCES EL SISTEMA SHALL atomically increment the `DROPPED_MESSAGES` counter in the control header and return `RING_BUFFER_FULL` without crashing or corrupting memory.
- **FR-303-05 (Ubiquitous Memory Integrity & Magic Header Verification)**: EL SISTEMA SHALL continuously verify the 32-bit Magic signature (`0x454F534D`) and version in the control header and reject invalid, corrupted, or uninitialized shared buffers fail-closed.
- **FR-303-06 (Cryptographic Proof Receipt)**: WHEN a shared memory arena audit completes, THE SYSTEM SHALL emit a verification receipt at `docs/evidence/SHARED_MEMORY_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1593 SharedArrayBuffer Off-Heap Arena Initialization
  GIVEN a requested capacity (e.g. 64 KB)
  WHEN EosSharedMemoryArena.createArena(capacity) is invoked
  THEN a SharedArrayBuffer is allocated with 64-byte control header
  AND Magic signature (0x454F534D) and initial atomic pointers (head=0, tail=0) are formatted correctly.

SCENARIO: BDD-1594 Lock-Free SPSC Enqueue and Dequeue Protocol
  GIVEN an active shared memory arena and a producer
  WHEN the producer enqueues a message payload
  THEN the payload is written directly to the circular data segment
  AND consumer dequeues the exact byte payload with 0 GC object serialization overhead.

SCENARIO: BDD-1595 Multi-Message Circular Ring Wrap-Around
  GIVEN an arena with finite capacity (e.g. 1024 bytes)
  WHEN multiple sequential messages are produced and consumed past the buffer boundary
  THEN the ring buffer wraps around smoothly without pointer overflow or memory corruption.

SCENARIO: BDD-1596 Buffer Overrun Protection and Drop Counter Integrity
  GIVEN an arena near capacity and a consumer that is paused
  WHEN a producer attempts to enqueue a payload exceeding available free capacity
  THEN enqueue fails gracefully returning success=false with RING_BUFFER_FULL
  AND the atomic droppedMessages counter is incremented by 1.

SCENARIO: BDD-1597 Memory Corruption and Magic Header Guard
  GIVEN an uninitialized or tampered SharedArrayBuffer with an invalid magic signature
  WHEN an arena instance is attached
  THEN the constructor rejects the buffer fail-closed with INVALID_ARENA_HEADER
  AND prevents reading or writing corrupted memory.

SCENARIO: BDD-1598 End-to-End Cryptographic Audit Receipt Generation
  GIVEN an audit executed via toolchain:shm:audit or auditSharedMemoryPipeline
  WHEN the audit completes
  THEN docs/evidence/SHARED_MEMORY_RECEIPT.json is written
  AND contains totalAllocatedBytes, messagesProcessed, zeroCopyVerified, avgLatencyNanos, and a valid sha256Signature.
```
