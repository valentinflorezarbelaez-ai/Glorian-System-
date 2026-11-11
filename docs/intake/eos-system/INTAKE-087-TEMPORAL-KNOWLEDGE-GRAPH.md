# INTAKE-087: Layer-0 Temporal Knowledge Graph & Datalog Query Engine (SPEC-202)

- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Principal Architect & Owner)
- **Lifecycle Tier**: Core / Knowledge Reasoning & Deductive Logic
- **Context**: Temporal Entity Graphs, Deductive Datalog Inference, Architecture Lineage & Time-Travel Proofs

---

## 1. Problem Statement

Complex enterprise systems and multi-agent meshes require reasoning over time-varying facts, structural dependencies, and architectural evolution (e.g., "Was Service A allowed to talk to Database B on date X?", "What transitively depends on component C considering deprecation windows?"). Traditional relational databases and static graph engines lack bi-temporal validity tracking, while external graph systems (Neo4j, Datomic) impose heavy infrastructure, network latency, and non-hermetic dependencies (violating Law V: zero external runtime dependencies).

Glorian requires a zero-dependency, in-memory, Layer-0 **Temporal Knowledge Graph & Datalog Query Engine** (`EosTemporalKnowledgeGraph`) that models temporal quadruples `(subject, predicate, object, [validFrom, validTo])` with bi-temporal tracking, stratified Datalog fixed-point forward chaining, cycle-safe recursive reachability, and point-in-time time-travel querying.

---

## 2. Requirements & Scope

1. **Temporal Quadruple Storage & Multidirectional Indexing**:
   - Quadruple schema: `(subject: string, predicate: string, object: string, validFrom: number, validTo: number, transactionTime: number)`.
   - In-memory forward and inverted indices: `SPO`, `POS`, `OSP`, and interval containment indices.
2. **Stratified Datalog Deduction Engine**:
   - Rule formulation: `Head(X, Y) :- Body1(X, Z), Body2(Z, Y)`.
   - Bottom-up fixed-point forward chaining operator ($T_P$) with semi-naïve evaluation.
   - Guarded recursion, cycle detection, and stratum convergence bounds.
3. **Temporal Reasoning & Time-Travel Queries**:
   - `asOf(timestamp)`: Point-in-time state evaluation.
   - `during(startTime, endTime)`: Interval intersection query.
   - Transitive causal reachability path across historical intervals.
4. **Deterministic Serialization & Cryptographic Receipts**:
   - Tamper-evident SHA-256 state and query receipts.
   - Complete export / restore of facts, rules, and temporal indices.
5. **CLI & MCP Control Surfaces**:
   - CLI commands `glorian tkg:assert` and `glorian tkg:query`.
   - MCP actions `tkg_assert` and `tkg_query`.
