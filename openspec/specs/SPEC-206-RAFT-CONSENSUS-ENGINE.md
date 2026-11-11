# SPEC-206: Layer-0 Distributed Raft Consensus Engine with Replicated FSM

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Core / Distributed Systems & Fault-Tolerant Consensus
- **Standard**: Stanford Raft (Ongaro & Ousterhout, 2014) / IEEE Distributed Computing
- **Module**: `src/core/eosRaftConsensusEngine.ts`

---

## 1. Context and Rationale

Autonomous multi-agent swarms, distributed lock managers, and planetary registry synchronizers require shared linearizable state across nodes without central single points of failure. Traditional consensus solutions (ZooKeeper, etcd, Consul) introduce heavy external daemon processes, Go/Java runtime dependencies, and complex network configurations that violate air-gapped zero-dependency mandates (Law V: zero external runtime dependencies).

`EosRaftConsensusEngine` provides an in-memory, zero-dependency, Layer-0 distributed consensus engine with replicated finite state machines (FSM) implementing the complete Raft protocol: leader election with randomized timeouts, majority quorums, log consistency matching, minority partition isolation, and tamper-evident SHA-256 state receipts.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1049 (Ubiquitous - Majority Quorum Leader Election)**: `THE SYSTEM SHALL elect at most one leader per term through majority quorum voting when a candidate gathers votes from floor(N/2) + 1 nodes.`

- **FR-1050 (Ubiquitous - Linearizable Log Entry Replication)**: `WHEN a client command is proposed to the leader, THE SYSTEM SHALL append it to leader log, broadcast AppendEntries RPCs, and commit upon majority replication.`

- **FR-1051 (Event-Driven - Stale Log Conflict Resolution)**: `WHEN a follower detects mismatching log terms or indices, THE SYSTEM SHALL truncate conflicting entries and overwrite with leader's authoritative sequence.`

- **FR-1052 (Ubiquitous - Network Partition Resilience & Safety)**: `THE SYSTEM SHALL prevent state commits in minority partitions and automatically re-synchronize when partitions heal.`

- **FR-1053 (Ubiquitous - Replicated State Machine Snapshotting & Cryptographic Receipts)**: `THE SYSTEM SHALL compact committed log entries into Merkle snapshots and emit tamper-evident SHA-256 cluster consensus receipts.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1049 Leader election through majority quorum
  GIVEN an initialized Raft cluster with N nodes
  WHEN election timeouts trigger without heartbeats
  THEN exactly one candidate collects votes from at least floor(N/2) + 1 nodes
  AND transitions to LEADER role for the new term.

SCENARIO: BDD-1050 Log entry append, replication, and commit to state machine
  GIVEN an established Raft leader
  WHEN a command is submitted to the cluster
  THEN the leader replicates the entry across peers
  AND commits the entry to the replicated FSM once a majority acknowledges.

SCENARIO: BDD-1051 Conflict resolution and stale follower log overwrite
  GIVEN a follower with conflicting uncommitted log entries from an old term
  WHEN an authoritative AppendEntries RPC arrives from the current leader
  THEN the follower truncates conflicting entries and matches the leader's log prefix.

SCENARIO: BDD-1052 Network partition resilience and split-brain prevention
  GIVEN a cluster split into minority and majority partitions
  WHEN commands are proposed to both partitions
  THEN only the majority partition can commit entries
  AND healing the partition re-aligns all nodes without split-brain anomalies.

SCENARIO: BDD-1053 End-to-end CLI execution and cryptographic state receipt
  GIVEN a cluster simulation invoked via glorian raft:cluster
  WHEN consensus is evaluated across nodes
  THEN the CLI reports leader status, commit index, and FSM state
  AND outputs an immutable SHA-256 cluster consensus receipt.
```

---

## 4. Architectural Boundaries and Invariants

1. **Law V Compliance**: Strictly zero external runtime dependencies (`"dependencies": {}`).
2. **Quorum Invariant**: Any commit requires acknowledgment from strictly $> N/2$ nodes.
3. **Immutability & DbC**: Replicated states and log entries sealed with `deepFreeze`, guarded by preconditions and postconditions.
