# SPEC-170: Leader Election Cluster with Quorum, Terms, and Lease Expiry

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arboláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Distributed control planes must agree on a single leader without a central coordinator and must detect a failed leader quickly enough to prevent split-brain. The `EosLeaderElectionCluster` module implements a term-based, quorum-based election with heartbeat leases, following the leader-election mechanics of Raft and etcd.

A node that starts an election increments its term, votes for itself, and solicits votes from the other nodes; it becomes LEADER only when the granted votes reach a strict majority (floor(N/2)+1). Voters enforce one vote per term and never regress their term, so a stale candidate is refused. Once elected, the leader refreshes follower leases via heartbeats, and a lease check forces the leader to step down if a quorum of followers has not heard from it in time.

The cluster requires at least three unique nodes to make quorum meaningful and exposes a deterministic cluster-state fingerprint for reproducibility. It is Layer-0, depending only on shared kernel primitives.

## 2. Functional Requirements (EARS Syntax)

- **FR-791 (Ubiquitous - Quorum Sizing and Cluster Composition)**: `The system shall require at least three unique node ids at construction and shall compute quorumSize as floor(N/2)+1.`
- **FR-792 (Event-Driven - Term Increment and Self-Vote)**: `WHEN elect is invoked for a known node, the system shall increment the candidate's currentTerm, mark it CANDIDATE, and record a self-vote before soliciting votes from the other nodes.`
- **FR-793 (State-Driven - Quorum Ascension)**: `WHILE the candidate's vote responses are collected, the system shall promote the candidate to LEADER only when the number of granted votes reaches quorumSize, and shall then update followers' roles, leader id, and terms to at least the elected term.`
- **FR-794 (Unwanted Condition - One Vote Per Term Safety)**: `IF a voter has already voted for a different candidate in the same term, or the candidate's term is lower than the voter's current term, THEN the system shall deny the vote.`
- **FR-795 (Event-Driven - Heartbeat Lease Refresh)**: `WHEN the leader emits a heartbeat, the system shall refresh each follower's lastHeartbeatMs to the current time and advance their term to at least the leader's current term.`
- **FR-796 (Unwanted Condition - Split-Brain Step-Down)**: `IF a lease check finds that at least quorumSize followers have expired past leaseMs, THEN the leader shall step down to FOLLOWER and clear its leader id; the system shall also expose a deterministic clusterFingerprint() over node id, role, term, and vote.`

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-791 A majority-vote candidate becomes leader
  GIVEN a cluster of five nodes n1..n5 with quorumSize 3
  WHEN elect("n2") is invoked
  THEN the resulting role is "LEADER"
  AND leader() returns "n2"
```

```gherkin
SCENARIO: BDD-792 Votes are denied when a majority has already voted at the same term
  GIVEN a three-node cluster where nodes x and y have already voted for y at term 1
  WHEN elect("z") is invoked at the same term
  THEN both x and y deny their votes and quorum (2) is unreachable
  AND elect returns "FOLLOWER" and leader() is null
```

```gherkin
SCENARIO: BDD-793 Heartbeat refreshes follower leases
  GIVEN a three-node cluster where n1 has been elected leader
  WHEN heartbeat("n1") is invoked and checkLease() is called
  THEN the heartbeat returns a term of at least 1
  AND the lease check reports alive true
```

```gherkin
SCENARIO: BDD-794 Elections increment terms monotonically and clusters require three nodes
  GIVEN a three-node cluster
  WHEN elect("a") then elect("b") are invoked
  THEN the currentTerm of "b" is strictly greater than the recorded term of "a"
  AND constructing a cluster with only two nodes throws an "at least 3 nodes" error
  AND two identically-driven clusters produce the same clusterFingerprint()
```

## 4. Architecture Decision Records (ADRs)

- **ADR-170-1: Term-monotonic elections with quorum-based single leader**

  - _Context_: Without coordination, multiple nodes could believe they are leader, and a stale candidate could disrupt an established leader.
  - _Decision_: Require strict-majority quorum (floor(N/2)+1), increment the candidate term on each election, enforce one vote per term, and never regress a voter's term.
  - _Consequence_: At most one leader can exist per term and stale candidates are refused, but a prolonged partition intentionally leaves the cluster without a leader rather than risking split-brain.

- **ADR-170-2: Heartbeat leases with quorum-based leader step-down**
  - _Context_: A leader that loses contact with a quorum must relinquish authority so a new leader can emerge.
  - _Decision_: Track lastHeartbeatMs per follower against leaseMs; if at least quorumSize followers are expired, the current leader steps down to FOLLOWER and clears its leader id.
  - _Consequence_: Leadership liveness follows a simple time-based lease, but the check is caller-driven (via checkLease) rather than an autonomous timer, keeping the core deterministic and dependency-free.

## 5. Atomic Task DAG

1. [x] **TASK-170-1**: Author SPEC-170 defining leader-election requirements, BDD scenarios, and ADRs.
2. [x] **TASK-170-2**: Implement `src/core/eosLeaderElectionCluster.ts` with quorum elections, term safety, heartbeats, lease expiry, and cluster fingerprinting.
3. [x] **TASK-170-3**: Add the `SPEC-170` suite to `test/eosBigTechTransactions.test.mjs` covering election, vote denial, quorum sizing, heartbeat lease, monotonic terms, minimum nodes, and fingerprinting.
4. [x] **TASK-170-4**: Verify with `npm run typecheck` and the CI pipeline stages (7/7 exit code 0).
