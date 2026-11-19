# SPEC-348: Distributed Bitemporal CRDT Memory Synchronizer

## 0. Intent

In distributed multi-agent clusters and edge swarms, concurrent memory modifications must reconcile without central locks or data loss. This specification formalizes `EosDistributedCrdtMemoryCore`, a pure Layer-0 conflict-free replicated data type (CRDT) engine providing Observed-Remove Sets, Last-Write-Wins Maps, and PN-Counters anchored in bitemporal valid/transaction time with mathematical Strong Eventual Consistency (SEC).

Doctrine: **Law I (Specification as Supreme Truth)**, **Law III (Evidence Over Claims)**, and **Law V (Architectural Purity)**.

---

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO an agent node mutates a memory register, EL SISTEMA updates local CRDT structures (LWW-Map, ORSet, PN-Counter) and logs a bitemporal transaction entry with Hybrid Logical Clock (HLC) timestamps.
- **FR-2 (Event-Driven)**: CUANDO delta updates from remote agent nodes arrive, EL SISTEMA applies the join-semilattice operator ($\sqcup$) ensuring commutative, associative, and idempotent convergence.
- **FR-3 (State-Driven)**: MIENTRAS resolving write conflicts on the same key with identical physical timestamps, EL SISTEMA applies deterministic tie-breaking based on lexicographical node identifier ordering.
- **FR-4 (Event-Driven)**: CUANDO evaluating observed-remove operations, EL SISTEMA uses unique causal birth tags such that an element is present if and only if its addition tag set is not a subset of its removal tombstone set.
- **FR-5 (Event-Driven)**: CUANDO `auditDistributedCrdtMemory()` executes, EL SISTEMA verifies commutativity ($A \sqcup B = B \sqcup A$), idempotency ($A \sqcup A = A$), bitemporal query accuracy, and emits a cryptographic evidence receipt to `docs/evidence/DISTRIBUTED_CRDT_MEMORY_RECEIPT.json`.
- **FR-6 (Ubiquitous)**: EL SISTEMA exposes CLI commands `toolchain:crdtmem:put`, `toolchain:crdtmem:get`, `toolchain:crdtmem:merge`, `toolchain:crdtmem:sync`, and `toolchain:crdtmem:audit` with clean `--json` machine contracts.

---

## 2. Non-Functional Requirements

- **NFR-1**: 100% pure Layer-0 implementation (`dependencies: {}` in `package.json`). Zero external distributed database drivers.
- **NFR-2**: All touched and newly created modules must strictly conform to $\le 800$ lines with $\ge 12$ lines of headroom (SPEC-250).
- **NFR-3**: In-memory delta merge of 10,000 registers must complete in $< 10$ milliseconds.
- **NFR-4**: Mathematical safety guarantee: convergence is order-independent and deterministic across any network topology.

---

## 3. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1867 Local CRDT Memory Register Mutation and HLC Generation
  DADO an isolated agent node with memory store
  CUANDO setLwwRegister executes with key and value
  ENTONCES the value is stored with monotonically increasing HLC timestamp
  Y a bitemporal transaction is logged with SHA-256 state digest.

ESCENARIO: BDD-1868 Commutative and Associative Delta Merging Across Disconnected Nodes
  DADO two disconnected nodes A and B with concurrent mutations
  CUANDO mergeDeltas(A, B) and mergeDeltas(B, A) execute
  ENTONCES both resulting memory stores reach identical state hashes
  Y commutativity (A ⊔ B = B ⊔ A) is verified.

ESCENARIO: BDD-1869 Deterministic LWW-Map Conflict Resolution with Tie-Breaking
  DADO two concurrent writes to the same key with identical timestamps from Node1 and Node2
  CUANDO mergeDeltas executes
  ENTONCES the tie-breaker selects the node with highest lexicographical ID
  Y both nodes converge to the exact same value.

ESCENARIO: BDD-1870 Observed-Remove Set (ORSet) Add-Wins Concurrency
  DADO concurrent operations: Node A adds element X, Node B removes element X
  CUANDO mergeDeltas executes
  ENTONCES the add-wins semantic preserves element X because of the new causal birth tag
  Y no data is lost to race conditions.

ESCENARIO: BDD-1871 Bitemporal Point-in-Time Historical Query
  DADO a sequence of mutations over time
  CUANDO queryAsOf executes with a past validTime and transactionTime
  ENTONCES the historical value active at that exact temporal coordinate is returned
  Y subsequent mutations do not leak into the historical snapshot.

ESCENARIO: BDD-1872 Distributed CRDT Audit Receipt and Cryptographic State Convergence
  DADO a cluster of 3 distributed agent nodes
  CUANDO auditDistributedCrdtMemory executes
  ENTONCES all convergence, bitemporal, and CRDT invariants report PASS
  Y a verifiable SHA-256 evidence receipt is written to docs/evidence/DISTRIBUTED_CRDT_MEMORY_RECEIPT.json.
```
