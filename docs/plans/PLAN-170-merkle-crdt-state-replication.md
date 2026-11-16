# PLAN-170: Architecture Decision Record (ADR-170) — Decentralized Cross-Fleet Merkle-CRDT State Replication Protocol

## 1. Architectural Context

Glorian System orchestrates an autonomous fleet of 9 production repositories across distributed environments (edge workers, CI runners, local worktrees, microVM sandboxes). With `SPEC-307` having established the Autonomous Continuous Reconciliation Loop, the fleet requires a robust, decentralized protocol to replicate state updates, telemetry, FDIR events, and architectural tickets without single points of failure, distributed locks, or centralized databases.

## 2. Decision: Merkle-DAG + Delta-CRDT + WASM Linear Memory Acceleration

We implement `EosCrdtStateReplicatorCore` combining three proven architectural pillars:

1. **Merkle-DAG Causal History (Content Addressing)**:
   - Each state change is modeled as a `MerkleNode`:
     - `cid`: SHA-256 hash of `parents + lamport + actor + payload`.
     - `parents`: array of CID strings representing direct causal predecessors (vector clock happens-before ordering).
     - `actor`: unique identifier of the originating node/agent.
     - `lamport`: monotonically increasing Lamport logical timestamp.
     - `payload`: typed mutation delta (`LwwDelta`, `PnDelta`, `OrSetDelta`).
2. **Algebraic Join-Semilattices ($\mathcal{S}, \sqcup$)**:
   - Deterministic, lock-free state convergence guaranteed by:
     - **Associativity**: Order of pairing deltas does not change the result: $(A \sqcup B) \sqcup C = A \sqcup (B \sqcup C)$.
     - **Commutativity**: Arrival order of network packets does not change the result: $A \sqcup B = B \sqcup A$.
     - **Idempotency**: Duplicate packets or retransmissions have no effect: $A \sqcup A = A$.
   - Three core CRDT structures:
     - **LWW-Register**: Values timestamped with Lamport logical time, resolving ties deterministically via lexicographical actor ID sorting.
     - **PN-Counter**: Vector mapping actor IDs to positive increments ($P$) and negative decrements ($N$), with value $V = \sum P_i - \sum N_i$.
     - **OR-Set**: Add-wins set tracking active elements with unique cryptographic UUIDs/tags, preventing concurrent delete-resurrection anomalies.
3. **High-Performance Linear Memory Vector Merge (Rust/Zig/WASM Paradigm)**:
   - When merging high-dimensional version vectors or numerical state tables across the fleet, the engine uses zero-copy linear memory buffers (`WebAssembly.Memory` or TypedArray vector planes).
   - Element-wise max/add operations run in bounded, linear time ($O(N)$) with sub-microsecond latency, avoiding V8 garbage collector churn.
4. **Anti-Entropy Logarithmic Synchronization Protocol**:
   - Nodes exchange root Merkle hashes ($O(1)$ equality check).
   - If roots diverge, nodes recursively traverse tree branches to locate diverging subgraphs in $O(\log N)$ steps, exchanging strictly the delta nodes required to restore synchronization.
5. **Operational CI/CD Hardening**:
   - Fix `test/eosToolchainControlPlaneAndTlcLocal.test.mjs` to gracefully handle `DEFERRED_TO_CI_SETUP_JAVA` when Java is absent, and assert live verification when present.
   - Configure `actions/setup-java@v4` (Java 21) in `.github/workflows/eos-sovereign-cicd.yml` so GitHub Actions runners execute full live TLC verification.

## 3. Rejected Alternatives

- **Alternative A: Centralized Redis/Postgres state coordination**:
  - _Rejected_: Violates sovereign decentralization and introduces single point of failure and network partition vulnerability.
- **Alternative B: Two-Phase Commit (2PC) / Raft across all fleet nodes**:
  - _Rejected_: Synchronous consensus blocks write availability during edge network partitions (violating CAP availability theorem).
- **Alternative C: Unversioned JSON state overwrites**:
  - _Rejected_: Causes catastrophic data loss from concurrent writes and split-brain scenarios.

## 4. Consequences & Guarantees

- **Zero NPM Dependencies**: 100% pure TypeScript utilizing native `node:crypto` and typed arrays.
- **Sub-Microsecond Latency**: Vector merges executed in linear memory with zero heap allocation overhead.
- **Cryptographic Auditability**: SHA-256 receipts emitted in `docs/evidence/CRDT_REPLICATION_RECEIPT.json`.
- **File Hygiene**: Strict $\le 800$ line limit with $\ge 12$ lines headroom maintained (`SPEC-250`).
