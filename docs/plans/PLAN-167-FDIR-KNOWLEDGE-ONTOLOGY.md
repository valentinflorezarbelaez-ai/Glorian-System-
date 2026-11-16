# PLAN-167: FDIR Clinical Firewall for Knowledge Ontology & Sentinel Integration

- **Plan ID**: `PLAN-167`
- **Spec Reference**: `SPEC-305`
- **Change Reference**: `CHANGE-167`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T10:25:00Z
- **Status**: `APPROVED`

---

## 1. Architectural Overview

The FDIR (Failure Detection, Isolation and Recovery) Clinical Firewall protects the semantic knowledge mesh from relational fragmentation, ghost relations, and cyclic graph deadlocks.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EosFdirOntology                                 │
│                                                                        │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │ EosOntologyCyclotron  │              │ Clinical Firewall Scanner │  │
│  │ Nodes & Directed Edges│ ───────────► │ Detects severed endpoints │  │
│  └───────────────────────┘              └─────────────┬─────────────┘  │
│                                                       │                │
│                                         ┌─────────────▼─────────────┐  │
│                                         │    Quarantine Engine      │  │
│                                         │   ORPHAN_LINK_DETECTED    │  │
│                                         │   Tarjan SCC Cycle Break  │  │
│                                         └─────────────┬─────────────┘  │
│                                                       │                │
│                                         ┌─────────────▼─────────────┐  │
│                                         │ Surgical Purge & Restorer │  │
│                                         │ Relational Integrity 100% │  │
│                                         └─────────────┬─────────────┘  │
│                                                       │                │
│                                         ┌─────────────▼─────────────┐  │
│                                         │ EosSentinelDaemon Pulse   │  │
│                                         │ Live 24/7 Heartbeat Sync  │  │
│                                         └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Decision Records (ADRs)

### ADR-167-1: In-Place Graph Sanitization vs Node Deletion

- **Context**: When an edge points to a non-existent or corrupted target node, should the source node also be pruned?
- **Decision**: No. The source node represents a valid entity in the Ledger. The clinical firewall only prunes the invalid relation (the dangling edge) or substitutes it with a tombstoned reference, maintaining node entity immutability.
- **Consequences**: Zero data loss for existing entities; relational consistency restored.

### ADR-167-2: Tarjan SCC for Circular Deadlock Detection

- **Context**: Bidirectional or cyclical dependencies between entities can cause infinite recursion in transitive reachability queries (`asOf` traversals).
- **Decision**: Implement Tarjan's Strongly Connected Components algorithm ($O(V + E)$ linear time) to detect all feedback loops and isolate cyclic edges without stack overflow.
- **Consequences**: Sub-millisecond cycle identification even on graphs with thousands of nodes.

---

## 3. Implementation Plan & File Layout

1. `src/core/eosFdirOntology.types.ts`: Interface definitions.
2. `src/core/eosFdirOntology.ts`: Main implementation ($\le 800$ lines, $\ge 12$ lines headroom).
3. Connect `EosFdirOntology` to `EosSentinelDaemon.ts`.
4. `bin/commands/cliFdirOntology.mjs`: CLI commands.
5. `test/eosFdirOntology.test.mjs`: Test suite covering BDD-1605..BDD-1610.
