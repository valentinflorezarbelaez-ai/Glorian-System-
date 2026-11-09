# ARCHITECTURE PLAN & ADR: LMAX DISRUPTOR RING BUFFER & NANOSECOND OPTIMIZATION (PLAN-015)

## 1. Architectural Decision Record (ADR-029)

### Context

EOS coordinates high-concurrency event pipelines across 4 fleet repositories, 8 global POPs, and real-time audio DSP streams.
Standard Node.js `EventEmitter`, queue arrays (`Array.push()`/`Array.shift()`), and object allocations cause:

1. Heap fragmentation and $O(N)$ memory shifts.
2. Unpredictable V8 Garbage Collection pauses (Stop-The-World micro-pauses).
3. CPU cache thrashing due to pointer chasing in OOP reference graphs.

### Alternatives Considered & Rejected

1. **Node.js `EventEmitter` / `stream.Transform`**:
   - _Rejected_: Allocates closures and wrapper objects for every published event. Throughput caps at ~500,000 events/second with high GC pressure.
2. **Third-Party C++ Addons (e.g., node-disruptor)**:
   - _Rejected_: Requires native compilation (node-gyp, Python, MSVC) and external dependencies, violating Layer-0 hexagonal purity (`dependencies: {}`).
3. **Mutex / Semaphore Locking Queues**:
   - _Rejected_: Thread contention and context switching penalize latency by orders of magnitude (10µs+ vs < 100ns).

### Decision

Implement `EosDisruptorRingEngine` in pure Layer-0 TypeScript (`dependencies: {}`):

- **Circular Buffer of Power-of-2 ($2^{12} = 4096$)**: Allows single-cycle bitwise AND index wrapping (`seq & 4095`) replacing costly division/modulo.
- **Cache-Line Padded Sequencer**: 64-byte spacing preventing multi-core false sharing on CPU L1/L2 caches.
- **Direct Memory Slots**: Uses contiguous `ArrayBuffer` with views (`Float64Array`, `BigInt64Array`, `Uint8Array`) ensuring $0 \text{ B/op}$ heap allocation.
- **Fast Structural Byte Scanner**: Scans 64-byte blocks for JSON delimiters (`{`, `}`, `[`, `]`, `,`, `:`) achieving > 1,500 MB/s scanning speed.
