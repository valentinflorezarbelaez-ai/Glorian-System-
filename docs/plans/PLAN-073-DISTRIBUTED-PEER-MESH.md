# PLAN-073: Distributed Peer Mesh Engine

- **Owner**: Valentín Flórez Arbeláez (Architect & Owner)
- **Status**: APPROVED
- **Date**: 2026-11-10
- **Governed by**: SPEC-188, CHANGE-073

## 1. Architectural Strategy

Implement `src/core/eosDistributedPeerMesh.ts`:

1. **Node Membership Table**: In-memory map indexing all cluster peers, storing `nodeId`, `address`, `port`, `status` (`ALIVE` | `SUSPECT` | `DEAD`), `incarnation`, `metadata`, and `lastSeenTimestamp`.
2. **Failure Detector**: Heartbeat mechanism with configurable ping interval, suspect timeout, and dead timeout. Supports indirect probing (`ping-req`) pattern.
3. **Incarnation System**: Monotonically increasing epoch to resolve status conflicts deterministically (higher incarnation always wins).
4. **Vector Clock Engine**: Tracks causality for distributed key-value state shared across the mesh. Provides monotonic element-wise clock merging and causal relation detection (`DOMINATES`, `EQUAL`, `CONCURRENT`, `PRECEDED`).
5. **Gossip Dissemination Protocol**: Infection-style epidemic protocol broadcasting delta updates to $k$ random alive peers.
6. **Design by Contract (DbC)**: Strict preconditions, postconditions, and invariant checks on all cluster state transitions.
