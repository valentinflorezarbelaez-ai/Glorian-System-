# PLAN-196: Deterministic Discrete-Event Simulation Hypervisor & Time-Travel Fault Injection Engine

## 1. Architectural Strategy & Topology

The Deterministic Discrete-Event Simulation Hypervisor (DESH) provides sovereign simulation, time-travel debugging, and Byzantine fault injection capabilities across virtualized distributed components.

```
 ┌─────────────────────────────────────────────────────────────┐
 │    Deterministic Discrete-Event Simulation Hypervisor      │
 │                                                             │
 │  ┌─────────────────────────┐   ┌─────────────────────────┐  │
 │  │ Virtual Monotonic Clock │   │ 64-bit PRNG (SplitMix64)│  │
 │  │  (Nanosecond Precision) │   │ (Deterministic Entropy) │  │
 │  └────────────┬────────────┘   └────────────┬────────────┘  │
 │               │                             │               │
 │               ▼                             ▼               │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │             Deterministic Priority Queue              │  │
 │  │  Order: (scheduledTimeNs, priority, sequenceNumber)  │  │
 │  └──────────────────────────┬────────────────────────────┘  │
 │                             │ Dispatch Next Event           │
 │                             ▼                               │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │          Byzantine Fault Injection Engine             │  │
 │  │ (Partition, Drop, Bit-Flip, Clock-Skew, Crash-Stop)   │  │
 │  └──────────────────────────┬────────────────────────────┘  │
 │                             │ Intercepted Delivery          │
 │                             ▼                               │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │              Virtual Node / Actor Mesh                │  │
 │  │   Node A ◄───────► Node B ◄───────► Node C (Nodes)    │  │
 │  └──────────────────────────┬────────────────────────────┘  │
 │                             │ Global State Snapshot         │
 │                             ▼                               │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │       Chandy-Lamport Checkpoint & Time-Travel         │  │
 │  │   (Atomic State Capture & Backtracking Rollback)      │  │
 │  └───────────────────────────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Decision Records (ADRs)

### ADR-196-001: Virtual Nanosecond Monotonic Clock & Priority Queue vs Wall-Clock Stepping

- **Context**: Testing distributed consensus, leader election, and high-concurrency algorithms under wall-clock `setTimeout` or `performance.now()` introduces race conditions, platform-dependent scheduler jitter, and slow test suites (waiting real seconds for timeouts).
- **Decision**: Decouple simulation time completely from the host operating system clock. Virtual time is represented as an unsigned 64-bit nanosecond monotonic integer. Execution advances instantaneously to the timestamp of the next event in a binary min-heap priority queue ordered by `(scheduledTimeNs, priority, sequenceId)`.
- **Rejected Alternative**: Hybrid wall-clock throttled loops, which are vulnerable to OS scheduler preemptions and cannot fast-forward hours of simulation time in milliseconds.

### ADR-196-002: Pure 64-bit Seeded PRNG Replay vs Host Platform `Math.random` / Crypto RNG

- **Context**: Autonomous chaos testing and simulated network jitter require randomness to explore complex failure topologies. However, non-reproducible bugs found in simulation are useless for forensics if they cannot be replayed bit-by-bit.
- **Decision**: Implement a pure Layer-0 deterministic 64-bit PRNG (SplitMix64) initialized with an explicit seed. Every randomized choice—message reordering, packet drops, clock drift deltas, and payload mutations—is derived strictly from this generator. Re-running the simulation with the same seed reproduces the exact sequence of states and failures.
- **Rejected Alternative**: Relying on `Math.random()` or Node's `crypto.randomBytes()`, which prevent deterministic replay across separate runs or test invocations.

### ADR-196-003: Chandy-Lamport Global Checkpoint Snapshots vs External Process Checkpointing / Forking

- **Context**: Deep bug investigation requires rewinding the simulation to the moment before a failure occurred (time-travel debugging) to inspect intermediate invariants or explore counterfactual execution branches. Operating system-level forks (`process.fork` / CRIU) are platform-dependent, heavy, and unsupported on Windows.
- **Decision**: Implement in-memory structured Chandy-Lamport inspired checkpoints. The hypervisor serializes virtual clock time, PRNG state, the pending event queue, node message inboxes, and internal node state dictionaries into an immutable snapshot record. Rollback reinstates this snapshot atomically, allowing branching or re-execution from any checkpoint ID.
- **Rejected Alternative**: Heavy VM or container snapshotting, which requires external virtualization tools and breaks the zero-dependency pure TypeScript Layer-0 invariant.
