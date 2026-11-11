# PLAN-100: Layer-0 Conflict-Free Replicated Data Types (CRDT) Collaborative State Synchronization Engine Architecture

## 1. Architectural Intent

Establish a zero-dependency, mathematically proven Layer-0 Conflict-Free Replicated Data Types (CRDT) engine (`EosCrdtStateSyncCore`). It provides lock-free, multi-master state synchronization, offline-first mutation autonomy, and Strong Eventual Consistency (SEC) across distributed nodes, edge workers, and peer-to-peer swarms under the 7 Inviolable Laws of EOS.

## 2. Mathematical Foundation: Semi-Lattices and Strong Eventual Consistency

1. **Join-Semilattice $\langle S, \sqcup \rangle$**:
   A partially ordered set equipped with a binary join operator $\sqcup: S \times S \to S$ satisfying:
   - **Commutativity**: $\forall a, b \in S: a \sqcup b = b \sqcup a$
   - **Associativity**: $\forall a, b, c \in S: (a \sqcup b) \sqcup c = a \sqcup (b \sqcup c)$
   - **Idempotency**: $\forall a \in S: a \sqcup a = a$
     These properties guarantee that any replica receiving any subset of states in any order will compute the identical least upper bound (supremum).
2. **Causal Vector Clock**:
   Mapping $\mathcal{V}: \text{NodeId} \to \mathbb{N}_{\ge 0}$.
   - Increment: $V[n] \leftarrow V[n] + 1$ on local write by node $n$.
   - Supremum Join: $(V_1 \sqcup V_2)[n] = \max(V_1[n], V_2[n])$.
   - Partial Order: $V_1 \le V_2 \iff \forall n: V_1[n] \le V_2[n]$.
   - Concurrency: $V_1 \parallel V_2 \iff \neg(V_1 \le V_2) \land \neg(V_2 \le V_1)$.
3. **LWW-Register (Last-Write-Wins)**:
   Triple $(v, t, n)$ where $v$ is the payload, $t$ is the Lamport timestamp, and $n$ is the node identifier.
   Merge rule: choose highest $t$, break ties lexicographically on $n$.
4. **ORSet (Observed-Remove Set)**:
   Two internal sets:
   - $AddSet \subseteq \mathcal{E} \times \mathcal{T}$ (pairs of element and unique tag).
   - $RemoveSet \subseteq \mathcal{T}$ (set of observed tags).
     An element $e$ is in the set if $\exists (e, \tau) \in AddSet$ such that $\tau \notin RemoveSet$.
     Merge: $AddSet_{\text{merged}} = AddSet_1 \cup AddSet_2$, $RemoveSet_{\text{merged}} = RemoveSet_1 \cup RemoveSet_2$.
5. **RGA (Replicated Growable Array)**:
   Sequence of vertices $\mathcal{V}$, each identified by $(t_i, n_i)$, carrying a value and a tombstone flag $\text{deleted} \in \{\text{true}, \text{false}\}$, linked by causal parent predecessor ID.
   Concurrent sibling insertions with the same predecessor are ordered by descending $(t_i, n_i)$. Deletions simply set the tombstone flag, preserving relative ordering for subsequent merges.
6. **Delta-State Extraction**:
   For any peer presenting a vector clock $V_{\text{peer}}$, the local replica filters all state entries whose local timestamp $> V_{\text{peer}}[n]$, transmitting only the minimal delta.

## 3. Layer-0 Hexagonal Isolation

- `src/core/eosCrdtStateSyncCore.types.ts`: Pure types, vector clock interfaces, LWW/ORSet/RGA data schemas, delta formats, and receipt structures.
- `src/core/eosCrdtStateSyncCore.ts`: Core class with DbC assertions (`assertPrecondition`, `deepFreeze`), vector clock operations, LWW, ORSet, RGA implementations, join semilattice merge, and delta extraction.
- Subpath: `"./crdt"` in `package.json`.
- CLI: `bin/commands/cliCrdtMesh.mjs` (`crdt:*`).
- MCP: `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlers.ts` (`crdt_*`).

## 4. Alternative Trade-offs Considered & Rejected

- **Operational Transformation (OT)**: Requires a central transformation server (e.g. Google Docs) and complex inversion matrices. Incompatible with decentralized multi-master mesh.
- **Pure Op-Based CRDTs without Persistence**: Require guaranteed causal exactly-once network transport. State-based and delta-state CRDTs are idempotent and partition-tolerant, ideal for peer meshes.
