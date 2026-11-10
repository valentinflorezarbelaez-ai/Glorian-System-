# SPEC-188: Decentralized Distributed Peer Mesh Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Infrastructure
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / SWIM Protocol / Vector Clock Causality
- **Module**: `src/core/eosDistributedPeerMesh.ts`
- **Composes**: SPEC-035 (Planetary Consensus), SPEC-036 (Dynamo Consistent Hashing), SPEC-186 (Enterprise Facade)

---

## 1. Context and Rationale

Modern distributed platforms (HashiCorp Consul/Serf, Apache Cassandra, Amazon Dynamo) require robust, peer-to-peer decentralized membership tracking and failure detection. A central coordinator introduces a single point of failure and bottleneck.

The SWIM gossip protocol provides scalable $O(1)$ message load per node per period and weak-consistency cluster membership tracking. By combining SWIM failure detection with vector clocks for causal ordering of cluster state mutations, Glorian System achieves fault-tolerant distributed operation across edge and cloud instances with zero external runtime dependencies.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-957 (Ubiquitous - Node Registration and Lifecycle)**: `THE SYSTEM SHALL maintain a local membership table of active nodes with attributes: nodeId, address, port, status (ALIVE, SUSPECT, DEAD), incarnation number, and lastSeenTimestamp.`

- **FR-958 (Event-Driven - Failure Detection State Transitions)**: `WHEN a heartbeat probe is unacknowledged within the ping timeout, THE SYSTEM SHALL transition the target node state to SUSPECT; WHEN the suspect timeout expires without contradiction, THE SYSTEM SHALL transition the node state to DEAD.`

- **FR-959 (Event-Driven - Incarnation Overrides)**: `WHEN an incarnation number strictly greater than the recorded incarnation is received for an ALIVE node, THE SYSTEM SHALL override any SUSPECT state and mark the node ALIVE.`

- **FR-960 (Ubiquitous - Vector Clock Causality)**: `THE SYSTEM SHALL track state mutations using vector clocks, incrementing the local node's counter on mutation and merging concurrent clocks with monotonic element-wise maximums.`

- **FR-961 (Ubiquitous - Gossip Infection Rounds)**: `THE SYSTEM SHALL propagate membership updates and state mutations across randomly selected peer subsets of size k (fanout) during each gossip round.`

- **FR-962 (Ubiquitous - Zero Dependencies)**: `THE SYSTEM SHALL implement all peer mesh, gossip protocol, and failure detection mechanics using native TypeScript and Node.js standard modules.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-957 Node joins cluster and initializes membership
  GIVEN a new EosDistributedPeerMesh instance with local node "node-1"
  WHEN another node "node-2" joins the mesh
  THEN the cluster membership table contains "node-2"
  AND status of "node-2" is "ALIVE"
  AND the local node's vector clock reflects the join event

SCENARIO: BDD-958 Failure detector transitions ALIVE to SUSPECT and DEAD
  GIVEN an active cluster with peer "node-2"
  WHEN "node-2" misses heartbeat probes exceeding suspect threshold
  THEN the status of "node-2" transitions to "SUSPECT"
  WHEN suspect timeout elapses with no acknowledgment
  THEN the status of "node-2" transitions to "DEAD"

SCENARIO: BDD-959 Higher incarnation revives SUSPECT node
  GIVEN peer "node-2" in "SUSPECT" state with incarnation 1
  WHEN an update arrives with status "ALIVE" and incarnation 2
  THEN the status of "node-2" is reset to "ALIVE"
  AND incarnation of "node-2" is updated to 2

SCENARIO: BDD-960 Vector clock causal ordering and conflict merge
  GIVEN node-1 and node-2 with concurrent state clocks
  WHEN the state is synchronized via gossip merge
  THEN the merged vector clock contains the element-wise maximum of all node counters
  AND causally preceding states are superseded

SCENARIO: BDD-961 Gossip message dissemination across peer fanout
  GIVEN a mesh of 5 active nodes
  WHEN node-1 broadcasts a metadata state change with fanout k=2
  THEN exactly 2 random active peers receive the gossip packet in the first round
```
