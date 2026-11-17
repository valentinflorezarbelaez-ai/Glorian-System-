# PLAN-177 — Distributed Consistent Hashing Vector Partition Mesh & Raft Sharding Engine

- **Specification**: `SPEC-315`
- **Milestone**: `v79.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)
- **Status**: `APPROVED`

---

## 1. Architectural Strategy & ADRs

### ADR-177-001: Consistent Hash Ring with Virtual Tokens (Chord / Dynamo Pattern)

- **Context**: Distributing vector keys across $N$ physical nodes requires balanced partition ownership with minimal reshuffling during scale-out or node departure.
- **Decision**: Adopt a $2^{32}-1$ integer ring with $V = 64..256$ virtual tokens per physical node. Binary search (`bisectRight`) on ordered token arrays provides $O(\log(N \cdot V))$ routing.
- **Alternatives Rejected**:
  - _Modulo Hashing ($hash(key) \pmod N$)_: Rejected because adding or removing 1 node reshuffles $(N-1)/N$ (~80-99%) of all keys, causing catastrophic network thrashing.
  - _Static Shard Range Partitioning_: Rejected because range partitions create skewed distributions (hot spots) when vector coordinate clusters concentrate in specific ranges.

### ADR-177-002: Raft Consensus for Partition Topology Logs

- **Context**: Multi-node clusters must agree on ring membership, node status (`JOINING`, `ACTIVE`, `LEAVING`, `DRAINING`), and shard boundaries without split-brain risk.
- **Decision**: Implement an in-memory, zero-dependency Raft state machine handling Leader Election, Heartbeats, AppendEntries, and Term monotonicity with majority quorum $Q = \lfloor N/2 \rfloor + 1$.
- **Alternatives Rejected**:
  - _Gossip-only eventual membership_: Rejected because temporary membership discrepancies cause split-brain routing and phantom vector drops.
  - _External ZooKeeper / etcd dependency_: Strictly rejected by Constitutional Law V (zero external dependencies).

### ADR-177-003: Scatter-Gather Federated Search with Reciprocal Rank Fusion

- **Context**: Queries must retrieve the global top-$k$ nearest neighbors across all partitions holding relevant vectors.
- **Decision**: Primary partition coordinators dispatch asynchronous shard searches, collect candidate lists of size $\max(k, efSearch)$, deduplicate across replicas, and sort by global quantized cosine distance.
- **Alternatives Rejected**:
  - _Centralized Coordinator Bottleneck_: Single fixed coordinator cannot scale with elastic traffic; every active node in Glorian can coordinate a query using ring topology.

---

## 2. Structural Layer Decomposition

```text
 ┌────────────────────────────────────────────────────────┐
 │ CLI: bin/commands/cliDistributedVectorMesh.mjs        │
 ├────────────────────────────────────────────────────────┤
 │ Router: bin/commands/cliToolchainRouter.mjs            │
 ├────────────────────────────────────────────────────────┤
 │ Core: src/core/eosDistributedVectorMesh.ts             │
 │       src/core/eosDistributedVectorMesh.types.ts       │
 ├────────────────────────────────────────────────────────┤
 │ Subordinate Engines:                                   │
 │   - EosSimdQuantizedHnswCore (SPEC-314) (Local Index) │
 │   - EosZeroCopyRingBufferCore (SPEC-312) (Replication)│
 ├────────────────────────────────────────────────────────┤
 │ Formal Model: docs/formal/DistributedVectorMesh.tla    │
 └────────────────────────────────────────────────────────┘
```

---

## 3. Verification Protocol

1. **Formal TLC Model Checking**: Verify `DistributedVectorMesh.tla` with 0 invariant breaches (`ValidLeaderQuorum`, `RingMonotonicity`, `ReplicationCoverage`).
2. **BDD Test Suite**: Verify `BDD-1665`..`BDD-1670` in `test/eosDistributedVectorMesh.test.mjs`.
3. **Hygiene & Parity**: 100% CLI parity across all 503 commands (`hygiene:audit`).
4. **Fast & Strict CI**: Full 7-stage SecDevOps verification.
