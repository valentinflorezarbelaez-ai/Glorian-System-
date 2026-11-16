# PLAN-174 — Zero-Copy Circular Ring-Buffer Telemetry & OTLP Streaming Bridge

- **Specification**: `SPEC-312`
- **Owner**: Valentín Flórez Arbeláez (Principal Architect & System Owner)
- **Status**: `APPROVED`
- **Date**: 2026-11-16

---

## 1. Architecture & Memory Layout

The Zero-Copy Ring Buffer resides entirely within a contiguous `SharedArrayBuffer` or `ArrayBuffer`.

### Memory Layout

```
+---------------------------------------------------------------+
| HEADER (64 Bytes, Cache-Line Padded)                          |
| 0x00: MAGIC (0x454F5352)   | 0x04: VERSION (1)                |
| 0x08: CAPACITY (power of 2)| 0x0C: SLOT_SIZE (64 bytes)       |
| 0x10: HEAD (atomic uint32) | 0x14: TAIL (atomic uint32)       |
| 0x18: DROPPED (atomic u32) | 0x1C: FLAGS (atomic uint32)      |
| 0x20..0x3F: RESERVED PADDING (32 bytes to cache-line boundary)|
+---------------------------------------------------------------+
| SLOTS ARENA (CAPACITY * 64 Bytes)                             |
| Slot 0 (64B)  | Slot 1 (64B)  | ... | Slot N-1 (64B)          |
+---------------------------------------------------------------+
```

Each Slot is 64 bytes:

- `timestamp_ns`: Int64 (8 bytes) at offset 0
- `event_type`: Uint32 (4 bytes) at offset 8 (1=GAUGE, 2=COUNTER, 3=SPAN, 4=LOG)
- `metric_id`: Uint32 (4 bytes) at offset 12
- `worker_id`: Uint32 (4 bytes) at offset 16
- `flags`: Uint32 (4 bytes) at offset 20
- `value`: Float64 (8 bytes) at offset 24
- `trace_id_high`: Int64 (8 bytes) at offset 32
- `trace_id_low`: Int64 (8 bytes) at offset 40
- `span_id`: Int64 (8 bytes) at offset 48
- `reserved`: Int64 (8 bytes) at offset 56

---

## 2. Sequence Operations

1. **Producer Slot Reservation**:
   - `head = Atomics.load(int32View, HEAD_OFFSET)`
   - `tail = Atomics.load(int32View, TAIL_OFFSET)`
   - Check if `(head - tail) >= capacity`:
     - If `FAIL_FAST`: return `{ success: false, dropped: false }`
     - If `DROP_OLDEST`: `Atomics.add(int32View, TAIL_OFFSET, 1)` and `Atomics.add(int32View, DROPPED_OFFSET, 1)`
   - `slotSeq = Atomics.add(int32View, HEAD_OFFSET, 1)`
   - `slotIdx = slotSeq & (capacity - 1)`
   - Calculate byte offset: `HEADER_SIZE + (slotIdx * SLOT_SIZE)`
   - Write slot fields using DataView / TypedArrays.
2. **Consumer Batch Drain**:
   - Read available slots: `min(head - tail, maxBatch)`
   - Read records from `tail & (capacity - 1)` to `(tail + batch - 1) & (capacity - 1)`
   - Advance `TAIL`: `Atomics.add(int32View, TAIL_OFFSET, batch)`

---

## 3. Rejected Alternatives

- **Node.js `EventEmitter` or Streams**: Rejected due to high object allocation rate and GC jitter under high event volumes.
- **Mutex / Locks**: Rejected because lock-free atomic sequencers provide non-blocking progress and immune to priority inversion.
- **Dynamic Resizing**: Rejected because dynamic resizing causes unpredictable memory fragmentation and pauses. Power-of-2 fixed allocation guarantees deterministic latency.
