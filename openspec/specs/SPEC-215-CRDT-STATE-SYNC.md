# SPEC-215: Layer-0 Conflict-Free Replicated Data Types (CRDT) Collaborative State Synchronization Engine

## Status

- **Status**: APPROVED
- **Change**: `CHANGE-100`
- **Architecture Decision Record**: `ADR-100`
- **Applicable Standards**: IEEE 830 EARS, ISO/IEC/IEEE 29148 BDD, Shapiro et al. (2011), Baquero et al. (2014), EOS Inviolable Laws I-VII

---

## Functional Requirements (EARS)

### FR-1094 (Ubiquitous - Causal Vector Clock & Partial Ordering Engine)

THE SYSTEM SHALL provide a causal vector clock tracking logical clock increments across unique node IDs $\mathcal{N}$, supporting vector comparison operations ($V_1 \le V_2$, $V_1 > V_2$, $V_1 \parallel V_2$ for concurrent divergence), and pairwise supremum merge $V_{\text{merged}}(i) = \max(V_1(i), V_2(i))$ without external clocks or network synchronization.

### FR-1095 (State-Driven - Last-Write-Wins Register & Set Synchronization)

THE SYSTEM SHALL implement a Last-Write-Wins Register (LWW-Register) and LWW-Element-Set storing values associated with monotonic logical timestamps and node identifiers, resolving concurrent conflicting updates deterministically by ordering timestamps and applying lexicographical node ID tie-breaking for equal timestamps:
$$(t_1, n_1) > (t_2, n_2) \iff (t_1 > t_2) \lor (t_1 = t_2 \land n_1 > n_2)$$

### FR-1096 (State-Driven - Observed-Remove Set (ORSet) Anomaly-Free Convergence)

THE SYSTEM SHALL implement an Observed-Remove Set (ORSet) maintaining an addition set $A$ of tagged elements $(e, \text{tag})$ and a removal set $R$ of tags, where an element $e$ is present in the set if and only if $\exists (e, \text{tag}) \in A \text{ such that } \text{tag} \notin R$, ensuring that concurrent additions and removals converge without element resurrection or lost updates across all merge orders.

### FR-1097 (State-Driven - Replicated Growable Array (RGA) Sequence & Text Editing)

THE SYSTEM SHALL implement a Replicated Growable Array (RGA) for ordered lists and sequential text collaboration where every node item is identified by a unique ID $(t_i, n_i)$ and points to its causal predecessor, inserting concurrent elements deterministically by descending timestamp order and marking deleted items with tombstones to preserve transitive order during concurrent edits.

### FR-1098 (Ubiquitous - Delta-State Sync, Semilattice Invariants, Receipts & Frontier Dispatch)

THE SYSTEM SHALL compute delta-state patches $\Delta$ between a local replica and a peer's vector clock summary, assert that all merge operations satisfy join-semilattice properties (commutativity $A \sqcup B = B \sqcup A$, associativity $(A \sqcup B) \sqcup C = A \sqcup (B \sqcup C)$, and idempotency $A \sqcup A = A$), emit immutable SHA-256 state receipts, and expose CLI commands `crdt:mutate`, `crdt:merge`, `crdt:delta` and MCP actions `crdt_mutate`, `crdt_merge`, `crdt_delta`.

---

## BDD Scenarios

### BDD-1094: Causal Vector Clock Invariants and Partial Ordering

GIVEN two distributed nodes `node-A` and `node-B`
WHEN each node increments its local logical clock independently
THEN the vector clock of `node-A` MUST be concurrent ($V_A \parallel V_B$) with `node-B`
AND WHEN the vector clocks are merged via supremum join
THEN the merged vector clock MUST be strictly greater than or equal to both $V_A$ and $V_B$.

### BDD-1095: LWW-Register Deterministic Conflict Resolution

GIVEN two replicas with an LWW-Register holding concurrent updates
WHEN replica A writes `val-A` at timestamp 100 with node `node-1`
AND replica B writes `val-B` at timestamp 100 with node `node-2`
THEN after bidirectional merge, both replicas MUST converge to `val-B`
AND the convergence MUST be independent of merge direction.

### BDD-1096: ORSet Concurrent Add-Remove Anomaly-Free Resolution

GIVEN an initial ORSet containing item `"config-entry"`
WHEN replica 1 concurrently deletes `"config-entry"`
AND replica 2 concurrently re-adds `"config-entry"` with a fresh tag
THEN after merging replica 1 and replica 2
THEN `"config-entry"` MUST remain in the set due to the fresh addition tag
AND no resurrection of previously observed tags shall occur.

### BDD-1097: RGA Collaborative Text and Sequence Ordering

GIVEN two replicas sharing the initial sequence `["H", "E", "L", "L", "O"]`
WHEN replica 1 inserts `"! "` after `"O"`
AND replica 2 concurrently inserts `", WORLD"` after `"O"`
THEN after merging both replicas in either order
THEN both replicas MUST produce an identical converged sequence
AND all character positions MUST preserve their causal predecessor links.

### BDD-1098: Delta-State Convergence and CLI/MCP Dispatch

GIVEN two divergent replicas with different mutation histories
WHEN a delta-state update is extracted and applied to the peer
THEN the peer MUST reach an identical SHA-256 state hash
AND CLI command `glorian crdt:merge --json` MUST output valid JSON with SHA-256 receipt.
