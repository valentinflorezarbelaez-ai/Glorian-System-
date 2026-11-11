# INTAKE-091: Layer-0 Distributed Raft Consensus Engine with Replicated FSM (SPEC-206)

- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Principal Architect & Owner)
- **Lifecycle Tier**: Core / Distributed Systems & Fault-Tolerant Consensus
- **Context**: Post-Bicentenario Vector 1 — Sovereign Multi-Agent Coordination & High-Availability Replicated Logs

---

## 1. Problem Statement

Autonomous multi-agent swarms, distributed lock managers, and planetary registry synchronizers require shared linearizable state across nodes without central single points of failure. Traditional consensus solutions (ZooKeeper, etcd, Consul) introduce heavy external daemon processes, Go/Java runtime dependencies, and complex network configurations that violate air-gapped zero-dependency mandates (Law V: zero external runtime dependencies).

Glorian requires an in-memory, zero-dependency, Layer-0 **Distributed Raft Consensus Engine with Replicated Finite State Machine** (`EosRaftConsensusEngine`) capable of:

1. Maintaining node roles (`FOLLOWER`, `CANDIDATE`, `LEADER`) with term-based randomized election timeouts.
2. Safe leader election under majority quorums ($\lfloor N/2 \rfloor + 1$) preventing split-brain scenarios.
3. Linearizable log entry replication with leader dominance and automatic log conflict truncation.
4. Deterministic state machine commitment and Merkle snapshot compaction.
5. Emitting tamper-evident SHA-256 cluster consensus receipts.

---

## 2. Requirements & Scope

1. **Raft Core Protocol**:
   - Ongaro & Ousterhout (Stanford 2014) standard implementation.
   - States: `currentTerm`, `votedFor`, `log[]`, `commitIndex`, `lastApplied`.
2. **RPC Primitives**:
   - `RequestVote(term, candidateId, lastLogIndex, lastLogTerm)`
   - `AppendEntries(term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit)`
3. **Safety & Fault Tolerance**:
   - Election Safety: at most one leader per term.
   - Leader Append-Only: leader never overwrites or truncates its own entries.
   - Log Matching Property: identical term & index guarantees identical prefix.
   - Leader Completeness: elected leader contains all committed entries.
   - State Machine Safety: if a server has applied an entry at index, no other server will ever apply a different entry.
4. **Partition & Chaos Simulation**:
   - In-memory simulated network transport supporting packet loss, drops, and network splits.
5. **CLI & MCP Control Surfaces**:
   - CLI commands `glorian raft:cluster` and `glorian raft:status`.
   - MCP actions `raft_cluster` and `raft_propose`.
