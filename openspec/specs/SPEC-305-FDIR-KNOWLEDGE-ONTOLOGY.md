# SPEC-305: FDIR Clinical Firewall for Knowledge Ontology & Sentinel Integration

- **Specification ID**: `SPEC-305`
- **Change ID**: `CHANGE-167`
- **Status**: `APPROVED`
- **Module**: `src/core/eosFdirOntology.ts`
- **Tier**: Autonomous Self-Healing, Graph FDIR & Sentinel Daemon Integration (Phase 5.1)
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-305-01 (Event-Driven Semantic Graph Inspection)**: WHEN an ontology graph is evaluated against active entities, THE SYSTEM SHALL scan all bi-temporal nodes, relations, and directional predicates for relational consistency.
- **FR-305-02 (State-Driven Orphan Link Detection & Quarantine)**: MIENTRAS relations exist whose target or source node is missing, tombstoned, or unverified, THE SYSTEM SHALL flag them as `ORPHAN_LINK_DETECTED` and isolate them into a quarantine manifest.
- **FR-305-03 (State-Driven Autonomous Surgical Purge & Relational Healing)**: MIENTRAS quarantined orphan links exist, THE SYSTEM SHALL surgically purge dangling edges without mutating node histories, restoring relational consistency aligned with ledger transactions.
- **FR-305-04 (Error / Unwanted Condition: Tarjan Cyclic Deadlock Isolation)**: SI a cyclic reference violates the directed acyclic semantic hierarchy, ENTONCES EL SISTEMA SHALL detect the cycle via Tarjan's strongly connected components (SCC) algorithm and isolate the loop fail-closed.
- **FR-305-05 (Ubiquitous Sentinel Daemon Pulse Integration)**: EL SISTEMA SHALL expose real-time FDIR metrics (`orphanLinksDetected`, `quarantinedLinksCount`, `healedLinksCount`) to `EosSentinelDaemon` to maintain continuous 24/7 pulse verification.
- **FR-305-06 (Cryptographic Proof Receipt)**: WHEN an FDIR ontology audit finishes, THE SYSTEM SHALL emit a verified receipt to `docs/evidence/FDIR_ONTOLOGY_RECEIPT.json` containing total edges scanned, orphan links purged, Tarjan cycles resolved, and a 64-hex SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1605 Bi-temporal Knowledge Graph Integrity Scan
  GIVEN an EosOntologyCyclotron instance with valid nodes and directed edges
  WHEN scanGraphIntegrity() is executed
  THEN zero anomalies are detected and graphHealth status is OPTIMAL_HARMONY.

SCENARIO: BDD-1606 Orphan Link Detection and Quarantine Isolation
  GIVEN an ontology graph where a target node has been removed or tombstoned
  WHEN scanGraphIntegrity() is executed
  THEN the dangling edge is detected with reason ORPHAN_LINK_DETECTED
  AND the severed relationship is isolated into the quarantine registry.

SCENARIO: BDD-1607 Autonomous Surgical Purging and Relational Restitution
  GIVEN a graph containing quarantined orphan links
  WHEN healGraphAnomalies() is executed
  THEN all dangling links are surgically removed from outgoing and incoming indices
  AND the resulting graph achieves 100% relational integrity.

SCENARIO: BDD-1608 Tarjan Strongly Connected Components Cyclic Deadlock Detection
  GIVEN a cyclic relationship chain (NodeA -> NodeB -> NodeC -> NodeA)
  WHEN detectTarjanCycles() is executed
  THEN the strongly connected component is identified with cycleLength >= 2
  AND the cycle is isolated to prevent infinite traversal recursion.

SCENARIO: BDD-1609 Live Integration with EosSentinelDaemon Heartbeat
  GIVEN EosSentinelDaemon running tick()
  WHEN FDIR ontology status is queried during the pulse
  THEN orphanLinksDetected reflects live graph metrics and status aligns with constitutional health.

SCENARIO: BDD-1610 End-to-End Cryptographic FDIR Receipt Generation
  GIVEN an audit executed via toolchain:fdir:audit or auditFdirOntologyPipeline
  WHEN the audit completes
  THEN docs/evidence/FDIR_ONTOLOGY_RECEIPT.json is written
  AND contains totalEdgesScanned, orphansPurged, cyclesResolved, and a valid 64-hex sha256Signature.
```
