# CHANGE-195: Autonomous Ontological Hypergraph & Bitemporal Entity Resolution Engine

## 1. Intent & Scope

Modern distributed software ecosystems and intelligence command systems require deep situational awareness across complex heterogeneous assets (services, squads, cryptographic credentials, infrastructure, compliance postures, and geopolitical threat vectors). Traditional binary property graphs fail when representing multi-party relationships without awkward join nodes, lack bitemporal fidelity to answer "what did the system know at time $T_{\text{tx}}$ about real-world events at time $T_{\text{valid}}$?", and do not provide cryptographic compartment isolation.

`CHANGE-195` introduces `EosOntologicalHypergraphCore`, establishing:

1. **Bitemporal Fact Ledger**: Independent valid-time and transaction-time intervals with point-in-time "as-of" snapshot querying.
2. **N-ary Relational Hyperedges**: Multi-participant atomic hyperedges with typed roles and cryptographic integrity hashes.
3. **Deterministic Entity Resolution**: Probabilistic and deterministic deduplication clustering disparate records into canonical entities with alias lineage.
4. **Multilevel Security (MLS) Lattice**: Strict Bell-LaPadula / Biba clearance verification with compartment filtering and fail-closed redaction.
5. **Topological Subgraph & Blast Radius Traversal**: Breadth-bounded traversal, shortest hyperpath search, and impact radius calculation.
6. **Formal TLA+ Model 77**: Mathematical proof of security lattice isolation and referential invariant preservation under Leslie Lamport's TLC model checker.

## 2. Impacted Components

- `src/core/eosOntologicalHypergraph.ts`: Core Layer-0 Ontological Hypergraph engine.
- `src/core/eosOntologicalHypergraph.types.ts`: Domain schemas, bitemporal intervals, hyperedge definitions, and security classifications.
- `src/core/index.ts`: Module exports.
- `bin/commands/cliOntologicalHypergraph.mjs`: CLI subdispatcher under prefix `toolchain:hypergraph:`.
- `bin/commands/cliToolchainRouter.mjs`: Router registration.
- `bin/commands/cliHelpCatalog.mjs`: Help catalog entries.
- `docs/DEVELOPER_GUIDE.md`: Developer guide and alphabetical index updates.
- `docs/formal/OntologicalHypergraph.tla` & `.cfg`: Formal TLA+ specification and model configuration.
- `scripts/run-tlc.mjs`: TLC runner registry.
- `test/eosOntologicalHypergraph.test.mjs`: BDD test suite (BDD-1773..1778).

## 3. Risk Assessment

- **Risk 1**: Temporal range explosion in point-in-time queries.
  - _Mitigation_: Efficient interval boundary indexing using timestamp comparison and closed-open interval conventions $[t_1, t_2)$.
- **Risk 2**: Information leakage across MLS security boundaries during hyperedge traversal.
  - _Mitigation_: Fail-closed filtering at the engine level prior to returning any traversal nodes or edge records.
