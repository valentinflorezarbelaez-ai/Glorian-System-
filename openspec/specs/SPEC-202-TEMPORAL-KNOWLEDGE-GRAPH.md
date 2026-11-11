# SPEC-202: Layer-0 Temporal Knowledge Graph & Datalog Query Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Core / Semantic Intelligence & Deductive Inference
- **Standard**: W3C RDF 1.1 / ISO/IEC 21838 (Top-level ontologies) / Datalog Foundation
- **Module**: `src/core/eosTemporalKnowledgeGraph.ts`

---

## 1. Context and Rationale

Complex enterprise systems and multi-agent meshes require reasoning over time-varying facts, structural dependencies, and architectural evolution (e.g., "Was Service A allowed to talk to Database B on date X?", "What transitively depends on component C considering deprecation windows?"). Traditional relational databases and static graph engines lack bi-temporal validity tracking, while external graph systems (Neo4j, Datomic) impose heavy infrastructure, network latency, and non-hermetic dependencies (violating Law V: zero external runtime dependencies).

`EosTemporalKnowledgeGraph` provides an in-memory, zero-dependency Temporal Knowledge Graph and Datalog reasoning engine that models temporal quadruples `(subject, predicate, object, [validFrom, validTo])` with transaction-time and valid-time tracking, stratified Datalog fixed-point forward chaining, cycle-safe recursive reachability, and point-in-time time-travel querying.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1029 (Ubiquitous - Bi-Temporal Quadruple Assertion)**: `THE SYSTEM SHALL store and index facts as temporal quadruples (subject, predicate, object, [validFrom, validTo]) with transaction timestamps and bidirectional lookup indices.`

- **FR-1030 (Ubiquitous - Stratified Datalog Fixed-Point Inference)**: `WHEN rules are evaluated, THE SYSTEM SHALL execute bottom-up forward chaining over temporal facts until reaching deductive fixed-point convergence without infinite loops.`

- **FR-1031 (Event-Driven - Point-in-Time Time-Travel Querying)**: `WHEN a query is executed with an asOf(timestamp) constraint, THE SYSTEM SHALL evaluate truth values strictly against facts valid at that exact temporal instant.`

- **FR-1032 (Ubiquitous - Temporal Causal Pathfinding & Reachability)**: `THE SYSTEM SHALL discover valid transitive dependency chains and causal paths between entities within specified temporal validity intervals.`

- **FR-1033 (Ubiquitous - Deterministic State Serialization & Tamper-Evident Receipts)**: `THE SYSTEM SHALL serialize the knowledge base and emit cryptographic SHA-256 receipts certifying state integrity and query derivations.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1029 Bi-temporal quadruple assertion and interval containment
  GIVEN an initialized temporal knowledge graph
  WHEN quadruples are asserted with specific valid-time intervals [t1, t2]
  THEN the graph indexes the fact across SPO, POS, and OSP indices
  AND queries filter facts by valid-time interval containment.

SCENARIO: BDD-1030 Stratified Datalog deductive rule inference
  GIVEN base facts and deductive Datalog rules (e.g. transitive dependency or permissions)
  WHEN evaluateRules is triggered
  THEN the engine derives intentional facts through fixed-point forward chaining
  AND terminates deterministically in bounded iterations.

SCENARIO: BDD-1031 Point-in-time time-travel evaluation (asOf)
  GIVEN facts asserted at different historical intervals
  WHEN querying with asOf(timestamp)
  THEN the results return strictly facts valid at that specific instant in time.

SCENARIO: BDD-1032 Causal temporal pathfinding and recursive reachability
  GIVEN a graph of connected entities across temporal intervals
  WHEN findTemporalPath is queried between a source and target
  THEN the engine computes the chronological causal path without cycles.

SCENARIO: BDD-1033 Deterministic state serialization and CLI verification receipt
  GIVEN an active temporal knowledge graph
  WHEN serialized to JSON and deserialized into a new instance
  THEN all facts, rules, and indices match bit-for-bit
  AND the CLI outputs an immutable SHA-256 verification receipt.
```

---

## 4. Architectural Boundaries and Invariants

1. **Law V Compliance**: Strictly zero external runtime dependencies (`"dependencies": {}`).
2. **Deterministic Complexity**: Forward chaining iteration bounded by universe size $|U|^k$.
3. **Immutability & DbC**: All public query results frozen with `deepFreeze`, guarded by preconditions and postconditions.
