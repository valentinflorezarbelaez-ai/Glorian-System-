# PLAN-162: Conflict-Free P2P Mesh Synchronization with Automerge Wasm

- **Plan ID**: `PLAN-162`
- **Change ID**: `CHANGE-162`
- **Spec Reference**: `SPEC-300`
- **Tier**: Distributed Systems, P2P CRDTs & Delay-Tolerant Networking (Phase 4.1)
- **Status**: `APPROVED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-15T22:48:00Z

---

## 1. Architectural Strategy & ADRs

### ADR-162-01: Pure Layer-0 Automerge CRDT Representation

- **Context**: In multi-agent environments, agents across Cursor, Antigravity, and CLI need to collaborate on document and code state without merge conflicts. While Automerge has npm packages (`@automerge/automerge`), installing them would violate **Law V** (zero runtime npm dependencies).
- **Decision**: Implement an in-process, pure Layer-0 Automerge-compatible CRDT document model in TypeScript. Model mutations as an append-only, content-addressed DAG where each change specifies:
  - `hash`: SHA-256 of the canonical change content.
  - `deps`: Array of parent change hashes (heads).
  - `actor`: Unique node / agent identifier.
  - `seq`: Monotonic sequence number per actor.
  - `ops`: List of property assignments, deletions, or text inserts.
- **Alternatives Considered & Rejected**:
  - _Installing @automerge/automerge npm package_: Rejected due to Law V violation.
  - _Git-only branching/merging_: Rejected because git merge requires human resolution of merge conflicts and cannot provide sub-second collaborative editing for live agents.

### ADR-162-02: Have/Need Differential Synchronization Protocol

- **Context**: Broadcasting full document snapshots on every keystroke wastes network bandwidth and CPU cycles.
- **Decision**: Implement the classic Automerge Have/Need sync protocol. Peers exchange their `heads` (tips of the DAG) and vector clocks. The sending peer walks backwards from its heads until it reaches the receiving peer's heads, transmitting only the topological slice of missing change operations.

### ADR-162-03: Delay-Tolerant Networking (DTN) Outbox Buffer

- **Context**: Agents frequently execute within disconnected sandboxes, offline subagents, or ephemeral containers where network connectivity is intermittent.
- **Decision**: Embed an in-memory and disk-flushable DTN store-and-forward outbox. When a peer is unreachable, serialize packets into the DTN queue. Upon reconnect, flush packets in causal order with idempotent deduplication.

---

## 2. Component Layout & Module Structure

```text
src/core/
  ├── eosAutomergeCrdtMesh.types.ts  (~120 lines) -> Change, Op, SyncMessage, PeerState, DTN types
  └── eosAutomergeCrdtMesh.ts        (~380 lines) -> Document engine, DAG, Lamport tie-breaker, DTN buffer

bin/commands/
  └── cliAutomergeCrdt.mjs           (~150 lines) -> CLI subcommands (sync, merge, state, audit)

test/
  └── eosAutomergeCrdtMesh.test.mjs  (~200 lines) -> BDD-1575..BDD-1580 verification
```

---

## 3. Strict Quality Gates

- Line count ceiling: All modules $\le 800$ lines with $\ge 12$ lines of headroom.
- Zero npm runtime dependencies (Law V).
- 100% command parity verified by `hygiene:audit`.
