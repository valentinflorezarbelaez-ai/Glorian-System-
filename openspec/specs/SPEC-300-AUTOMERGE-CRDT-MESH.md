# SPEC-300: Conflict-Free P2P Mesh Synchronization with Automerge Wasm

- **Specification ID**: `SPEC-300`
- **Change ID**: `CHANGE-162`
- **Status**: `APPROVED`
- **Module**: `src/core/eosAutomergeCrdtMesh.ts`
- **Tier**: Distributed Systems, P2P CRDTs & Delay-Tolerant Networking (Phase 4.1)
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-300-01 (Event-Driven Concurrent CRDT Document Mutation)**: WHEN a local agent or node mutates document state (setting a key, appending text, or modifying registers), THE SYSTEM SHALL generate an immutable change operation linked to current heads via SHA-256 parent hashes and increment the node's Lamport clock.
- **FR-300-02 (State-Driven Causal Convergence & Tie-Breaking)**: MIENTRAS two or more peer nodes execute concurrent conflicting writes on the same property, THE SYSTEM SHALL resolve conflict deterministically using Lamport timestamps and actor ID lexicographical ordering without data loss.
- **FR-300-03 (State-Driven P2P Differential Sync Protocol)**: MIENTRAS two peer nodes establish a sync session, THE SYSTEM SHALL compute head differences (`have` vs `need`), package missing change operations into compact binary-compatible sync packets, and apply them atomically to reach mathematical state convergence.
- **FR-300-04 (Error / Unwanted Condition: Network Partition & DTN Store-and-Forward)**: SI a peer is partitioned or offline, ENTONCES EL SISTEMA SHALL buffer pending change packets in a Delay-Tolerant Networking (DTN) queue and flush them upon network reconnection.
- **FR-300-05 (Ubiquitous Content-Addressed Hash DAG Verification)**: EL SISTEMA SHALL verify the cryptographic integrity of every received change operation against its SHA-256 hash and reject corrupted or tampered operations fail-closed.
- **FR-300-06 (Cryptographic Proof Receipt)**: WHEN a CRDT P2P mesh audit completes, THE SYSTEM SHALL emit a verification receipt at `docs/evidence/CRDT_MESH_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1575 Concurrent Mutation and Content-Addressed Causal DAG
  GIVEN two independent peer nodes (Peer A and Peer B) holding the same root document
  WHEN each peer performs local concurrent mutations without network connectivity
  THEN both peers produce immutable change operations with SHA-256 content hashes
  AND update their local Lamport clocks and DAG heads.

SCENARIO: BDD-1576 Deterministic Conflict Resolution and State Convergence
  GIVEN concurrent conflicting writes by Peer A and Peer B on the same property key
  WHEN the peers exchange sync messages and merge their state
  THEN both peers arrive at the exact same converged document state
  AND tie-breaking is deterministic based on Lamport clock and actor ID.

SCENARIO: BDD-1577 P2P Differential Sync Protocol (Have/Need Exchange)
  GIVEN Peer A with changes that Peer B does not possess
  WHEN Peer A generates a sync message for Peer B based on Peer B's known heads
  THEN the sync message contains only the missing delta changes
  AND applying the sync message advances Peer B's heads to match Peer A.

SCENARIO: BDD-1578 Delay-Tolerant Networking (DTN) Offline Queue and Reconnection
  GIVEN an offline agent generating multiple sequential mutations
  WHEN the network link is severed
  THEN mutations are buffered safely in the DTN outbox queue
  AND when connectivity is restored, all buffered packets flush and reconcile without dropped edits.

SCENARIO: BDD-1579 Cryptographic Integrity and Tamper Detection in Operation DAG
  GIVEN a change operation packet received from a peer
  WHEN the payload hash does not match its declared SHA-256 operation ID
  THEN the mesh engine rejects the packet with HASH_MISMATCH_REJECTED
  AND preserves local document integrity without corruption.

SCENARIO: BDD-1580 Cryptographic CRDT Mesh Audit Receipt Generation
  GIVEN an audit executed via toolchain:crdt:audit or auditCrdtMeshPipeline
  WHEN the audit completes
  THEN docs/evidence/CRDT_MESH_RECEIPT.json is written
  AND contains totalPeersTested, changesApplied, convergenceVerified, dtnPacketsDelivered, and a valid sha256Signature.
```
