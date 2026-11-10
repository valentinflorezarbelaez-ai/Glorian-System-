# SPEC-190: Delay-Tolerant Networking & Opportunistic Bundle Protocol Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Infrastructure
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / RFC 5050 / RFC 9171 (DTN Bundle Protocol)
- **Module**: `src/core/eosDelayTolerantMesh.ts`
- **Composes**: SPEC-036 (Anti-Entropy Merkle Sync), SPEC-188 (Distributed Peer Mesh)

---

## 1. Context and Rationale

Traditional internet transport protocols (TCP/IP) rely on continuous end-to-end paths with low round-trip times. In aerospace missions (SpaceX, NASA interplanetary links) and disconnected tactical defense theaters (Palantir edge deployments), network links suffer from severe delays, frequent disruptions, and long disconnection windows.

RFC 5050 and RFC 9171 define the Bundle Protocol architecture for Delay-Tolerant Networking (DTN). Nodes employ store-and-forward routing, custody transfer, and opportunistic synchronization to guarantee eventual delivery across disconnected nodes without requiring concurrent end-to-end paths.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-968 (Ubiquitous - Bundle Encapsulation)**: `THE SYSTEM SHALL encapsulate messages into discrete, self-contained bundles containing: bundleId, sourceNodeId, destinationNodeId, payload, payloadDigestSha256, creationTimestamp, ttlMs, and custodianNodeId.`

- **FR-969 (Event-Driven - Custody Transfer)**: `WHEN a peer node successfully accepts custody of a bundle, THE SYSTEM SHALL issue a custody acknowledgment receipt and update custody ownership to the accepting node.`

- **FR-970 (Event-Driven - Opportunistic Forwarding)**: `WHEN an opportunistic contact window opens with a peer node, THE SYSTEM SHALL identify and transmit all pending, non-expired bundles destined for that peer or suitable for multi-hop transit.`

- **FR-971 (Event-Driven - TTL Expiration Pruning)**: `WHEN the current timestamp exceeds creationTimestamp + ttlMs, THE SYSTEM SHALL drop the expired bundle from the store-and-forward queue and record an expiration telemetry event.`

- **FR-972 (Ubiquitous - Anti-Entropy Merkle Delta Sync)**: `THE SYSTEM SHALL exchange bundle catalog manifests to identify missing bundles between opportunistic contacts without re-transmitting existing payloads.`

- **FR-973 (Ubiquitous - Zero Dependencies)**: `THE SYSTEM SHALL implement all bundle protocol logic, Merkle set hashing, and custody tracking using native TypeScript and Node.js standard modules.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-968 Bundle creation with cryptographic integrity
  GIVEN an active EosDelayTolerantMesh node "ground-station-1"
  WHEN a bundle is created destined for "mars-rover-alpha" with 3600000ms TTL
  THEN bundleId is deterministically generated
  AND payloadDigestSha256 matches pureSha256 of the payload
  AND initial custodian is "ground-station-1"

SCENARIO: BDD-969 Custody transfer between disconnected nodes
  GIVEN node "ground-station-1" holding custody of bundle B1
  WHEN node "orbiter-relay" establishes contact and accepts custody of B1
  THEN custody of B1 is transferred to "orbiter-relay"
  AND a custody receipt is generated confirming transfer

SCENARIO: BDD-970 Store-and-forward opportunistic delivery
  GIVEN node A isolated from destination node C
  WHEN intermediary node B enters contact with node A
  THEN bundle B1 is forwarded to node B
  WHEN node B subsequently enters contact with destination node C
  THEN bundle B1 is delivered to destination node C

SCENARIO: BDD-971 Expired bundle pruning
  GIVEN a bundle with a short TTL of 50ms
  WHEN 100ms elapses without contact
  THEN evaluatePruning() removes the bundle from the store
  AND active bundle count decreases by 1

SCENARIO: BDD-972 Anti-entropy manifest exchange
  GIVEN two nodes with partially overlapping bundle stores
  WHEN computeManifestDelta is evaluated
  THEN missing bundle IDs are accurately identified without sending payloads
```
