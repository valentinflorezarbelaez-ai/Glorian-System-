# INTAKE-170: Decentralized Cross-Fleet Merkle-CRDT State Replication Protocol

**Target Subsystem**: `src/core/eosCrdtStateReplicator.ts` & `src/core/eosCrdtStateReplicator.types.ts`  
**Governed By**: SPEC-308, CHANGE-170, Commandment I (Supreme Truth), Commandment V (Zero NPM Dependencies)  
**Author**: Valentin Florez Arbelaez & Google Antigravity (Glorian Core Architects)  
**Date**: 2026-11-16  
**Status**: APPROVED & INTAKE COMPLETE

---

## 1. Problem Statement & Motivation

Glorian System operates an autonomous control plane governing 9 production repositories across the sovereign fleet:

1. `aberamentho`
2. `atp-strength`
3. `biblioteca-gnostica-1`
4. `control-de-asistencia-abopack`
5. `crud-slack`
6. `donaciones`
7. `eos-system`
8. `performance-talent-group`
9. `portafolio`

While `SPEC-307` introduced the Autonomous Continuous Reconciliation Loop (`EosAutonomousReconciliationLoopCore`), distributed autonomous agents operating across separate nodes, worktrees, edge regions, and isolated sandboxes face the fundamental challenge of distributed consensus and concurrent state mutations.

Traditional distributed architectures rely on centralized database locks, two-phase commits (2PC), or complex consensus protocols (Raft/Paxos) that introduce single points of failure, network latency bottlenecks, and network partition unavailability (violating CAP availability).

In high-performance engineering paradigms pioneered by Cloudflare Workers, Figma, and Amazon Dynamo:

- **Conflict-free Replicated Data Types (CRDTs)** guarantee mathematical convergence without locks.
- **Merkle Directed Acyclic Graphs (Merkle-DAGs)** provide cryptographic immutability, tamper-proof audit trails, and efficient anti-entropy synchronization.
- **WebAssembly (WASM) Linear Memory Kernels** (synthesizable via `SPEC-306`) execute vector joins and state merges at near-native hardware speed (~100 nanoseconds), bridging high-performance languages (Rust, Zig, C) with TypeScript control planes.

Glorian requires a dedicated **Decentralized Cross-Fleet Merkle-CRDT State Replicator**:

- Structuring all fleet state events into immutable Merkle-DAG nodes with SHA-256 content IDs (`cid`).
- Providing convergent join-semilattice operations ($\mathcal{S}, \sqcup$) across registers (LWW), counters (PN-Counter), and sets (OR-Set).
- Accelerating vector state convergence over hardware-isolated WASM linear memory arrays.
- Executing logarithmic anti-entropy root hash exchange ($O(\log N)$) to sync differing states across fleet nodes.
- Emitting cryptographic verification receipts conforming to in-toto v1.0 and SLSA provenance standards.

Additionally, this change repairs the remote CI test gate in `test/eosToolchainControlPlaneAndTlcLocal.test.mjs` and `.github/workflows/eos-sovereign-cicd.yml` where Java-less runner fallbacks were improperly asserted against live TLC execution modes.

---

## 2. Scope & Boundaries

- **In Scope**:
  - `src/core/eosCrdtStateReplicator.types.ts` (Merkle-DAG types, CRDT delta types, sync messages).
  - `src/core/eosCrdtStateReplicator.ts` (Pure TypeScript core engine, zero runtime dependencies).
  - High-performance WASM linear memory state vector merge accelerator.
  - CLI integration: `toolchain:crdt:replicate`, `toolchain:crdt:merge`, `toolchain:crdt:anti-entropy`, `toolchain:crdt:audit`.
  - Comprehensive automated test suite in `test/eosCrdtStateReplicator.test.mjs`.
  - TLC fallback assertion fix in `test/eosToolchainControlPlaneAndTlcLocal.test.mjs`.
  - CI workflow enhancement with `actions/setup-java@v4` in `.github/workflows/eos-sovereign-cicd.yml`.
  - Cryptographic receipt at `docs/evidence/CRDT_REPLICATION_RECEIPT.json`.
- **Out of Scope**:
  - External network sockets or third-party npm libraries (zero dependencies maintained).
  - Modifying `/api/` serverless endpoints (12/12 budget strictly preserved).
