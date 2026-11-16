# CHANGE-170: Decentralized Cross-Fleet Merkle-CRDT State Replication Protocol

## Metadata

- **Change ID**: `CHANGE-170`
- **Specification**: `SPEC-308`
- **Scope**: Glorian Distributed Consensus & Replication Plane (`src/core/eosCrdtStateReplicator.ts`)
- **Status**: `PROPOSED` -> `AUTHORIZED`
- **Classification**: High-Performance Distributed Systems / Merkle-DAG / CRDT Convergence / WASM Linear Memory / Zero Dependencies

## 1. Intent & Context

Empower Glorian System with a decentralized, lock-free state replication protocol connecting all 9 fleet projects across heterogeneous environments (edge workers, local nodes, isolated microVMs, sandboxes). By fusing Merkle Directed Acyclic Graphs (cryptographic content addressing and tamper-evidence) with Conflict-free Replicated Data Types (mathematically proven join-semilattice convergence) and WASM linear-memory hardware acceleration, the fleet achieves zero-conflict, sub-microsecond state synchronization without single points of failure.

In addition, this change permanently resolves remote CI non-determinism in TLC formal verification runner tests across Java-less runner matrix cells while incorporating `setup-java@v4` in sovereign CI/CD workflows.

## 2. Technical Scope

1. **Merkle-DAG Content Addressing**:
   - Every mutation is an immutable node identified by a SHA-256 Content ID (`cid = SHA-256(parents + lamport + actor + payload)`).
   - Cryptographic DAG history tracking preserving causal order (happens-before relationship).
2. **Delta-CRDT Convergence Engine**:
   - Pure algebraic join-semilattice ($\mathcal{S}, \sqcup$) guaranteeing:
     - Associativity: $(a \sqcup b) \sqcup c = a \sqcup (b \sqcup c)$
     - Commutativity: $a \sqcup b = b \sqcup a$
     - Idempotency: $a \sqcup a = a$
   - Supported state structures:
     - LWW-Register: Last-Write-Wins scalar with deterministic tie-breaking.
     - PN-Counter: Positive-Negative distributed integer counter.
     - OR-Set: Observed-Remove set with unique addition tag tracking.
3. **High-Performance WASM Linear-Memory Acceleration**:
   - Zero-copy linear memory buffers (`WebAssembly.Memory` or TypedArray vector planes).
   - High-speed array vector merge kernels executing at near-native CPU speeds (~100 nanoseconds), aligning with Rust/Zig compiled WASM paradigms.
4. **Anti-Entropy Merkle Synchronization**:
   - Fast $O(1)$ equality check via Merkle root hashes.
   - Efficient $O(\log N)$ logarithmic divergence isolation and delta sync for diverging nodes.
5. **Toolchain CLI Integration**:
   - `toolchain:crdt:replicate`: Replicates local delta changes to fleet peers.
   - `toolchain:crdt:merge`: Merges two conflicting state trees deterministically.
   - `toolchain:crdt:anti-entropy`: Compares Merkle roots and synchronizes diverging subgraphs.
   - `toolchain:crdt:audit`: Comprehensive verification and cryptographic receipt generation.
6. **Quality & Test Gates**:
   - BDD test suite (`test/eosCrdtStateReplicator.test.mjs`, `BDD-1623`..`BDD-1628`).
   - Line limit budget $\le 800$ lines, min headroom $\ge 12$ lines.
