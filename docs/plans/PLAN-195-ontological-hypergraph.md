# PLAN-195: Autonomous Ontological Hypergraph & Bitemporal Entity Resolution Engine

## 1. Architectural Strategy & Topology

The Autonomous Ontological Hypergraph integrates Spotify Backstage catalog entities with classified intelligence, defense, and telemetry models into a unified bitemporal knowledge graph with multi-level security.

```
 Heterogeneous Data Sources
 (Backstage, Telemetry, K8s, Threat Intel)
             │
             ▼
 ┌───────────────────────────────────────────────┐
 │       Deterministic Entity Resolution         │
 │ (Exact Match, N-Gram Fingerprint, Dedupe)     │
 └───────────────────────┬───────────────────────┘
                         │ Canonical Entities & Aliases
                         ▼
 ┌───────────────────────────────────────────────┐
 │        Bitemporal Assertion Engine            │
 │ Valid Time [V_from, V_to] x Tx Time [T_from,  │
 │ T_to] (Immutable Historical Auditability)     │
 └───────────────────────┬───────────────────────┘
                         │
                         ▼
 ┌───────────────────────────────────────────────┐
 │          Ontological Hypergraph Store         │
 │   • Canonical Entity Nodes                    │
 │   • N-ary Hyperedges (Roles & Relationships)  │
 └───────────────────────┬───────────────────────┘
                         │
                         ▼
 ┌───────────────────────────────────────────────┐
 │     Multilevel Security (MLS) Lattice Guard   │
 │ Bell-LaPadula & Biba Compartment Enforcement  │
 │ (UNCLASSIFIED -> SECRET -> TOP_SECRET)        │
 └───────────────────────┬───────────────────────┘
                         │ Filtered / Redacted Subgraphs
                         ▼
           Auditors / Operators / API Clients
       (As-Of Reconstruction & Blast Radius Analysis)
```

---

## 2. Architecture Decision Records (ADRs)

### ADR-195-001: Bitemporal Interval Representation vs Snapshot Copy-on-Write

- **Context**: In mission-critical and regulatory systems, answering "what happened in the real world" is fundamentally distinct from answering "what did the system believe at a given historical transaction moment". Snapshot copy-on-write leads to storage duplication and loses continuous time ranges.
- **Decision**: Adopt the standard SQL:2011 / Snodgrass bitemporal interval standard: each assertion records a valid-time interval $[v_{\text{from}}, v_{\text{to}}]$ and a transaction-time interval $[t_{\text{from}}, t_{\text{to}}]$. Point-in-time "as-of" evaluation filters records where $t_{\text{from}} \le T_{\text{tx}} < t_{\text{to}}$ and $v_{\text{from}} \le T_{\text{valid}} < v_{\text{to}}$.
- **Rejected Alternative**: Single-timeline auditing or Git-like snapshot branches, which cannot separate real-world event timing from database recording timing.

### ADR-195-002: N-ary Hyperedges vs Binary Edge Decomposition

- **Context**: Real-world operations involve multiple simultaneous entities (e.g. Squad A authorizes Deployment B of Component C to Cluster D using Key E). Modeling this as binary edges requires synthetic "event" or "join" nodes that obscure semantic meaning and inflate path lengths.
- **Decision**: Implement native $N$-ary hyperedges (`OntologicalHyperedge`) where a single relational record connects $N \ge 2$ participant entities, each assigned an explicit semantic role.
- **Rejected Alternative**: Binary labeled property graphs (LPG) with reified join nodes, which increase query complexity and double memory overhead.

### ADR-195-003: Bell-LaPadula / Biba Multilevel Security Lattice with Fail-Closed Redaction

- **Context**: Knowledge assets span multiple sensitivity tiers (unclassified public APIs, secret infrastructure keys, top-secret zero-day intelligence). Any cross-boundary traversal must strictly prevent privilege escalation and side-channel leakage.
- **Decision**: Implement a formal MLS lattice with 4 hierarchical levels (`UNCLASSIFIED` < `CONFIDENTIAL` < `SECRET` < `TOP_SECRET`) plus orthogonal compartment sets. Traversal and query APIs enforce fail-closed filtering: unauthorized nodes and hyperedges are pruned or redacted before reaching client consumers.
- **Rejected Alternative**: Role-based access control (RBAC) at the application perimeter without node-level security labels.
