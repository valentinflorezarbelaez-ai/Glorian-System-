# PLAN-031: PALANTIR HNSW VECTOR REASONING & ALADDIN RISK LEDGER ENGINE

## 1. Architectural Strategy & Clean Hexagonal Design

```
[ CLI (eos vector / sim / chain) & MCP Stream ]
                     │
                     ▼
[ Application Layer: EosHnswVectorEngine & EosMonteCarloEngine & EosMonotonicHashChain ]
                     │
                     ▼ (pure Layer-0 algorithms)
[ Mathematical Core: Cosine Sim, L2 Distance, HNSW Multi-Layer Skip-List, Beta-PERT ]
```

## 2. Architectural Decision Records (ADRs)

### ADR-044: Pure Layer-0 Hierarchical Navigable Small World (HNSW) Multi-Layer Graph

- **Context:** External vector databases (Pinecone, Qdrant, Milvus) introduce network hops, serialized JSON overhead, and cloud billing lock-in.
- **Decision:** Implement a self-contained in-memory HNSW index using contiguous multi-level adjacency lists, probabilistic layer assignment ($p = 1 / \ln(M)$), heuristic neighbor pruning, and Cosine/$L_2$ distance.
- **Invariants:** 0 external npm dependencies, sub-millisecond $k$-NN query latency, deterministic results.

### ADR-045: Unification of Aladdin Monte Carlo & SpaceX Hash-Chain into Main System

- **Context:** The control plane in `Eos-System-1` developed SPEC-019 (Monte Carlo) and SPEC-020 (Monotonic Hash-Chain), but the production deployment in `Eos-System` needs these capabilities in its native CLI, MCP server, and live landing dashboard.
- **Decision:** Port the tested algorithms to `src/core/eosMonteCarloEngine.ts` and `src/core/eosMonotonicHashChain.ts`.

## 3. Module Boundaries

- `src/core/eosHnswVectorEngine.ts` (Layer 0)
- `src/core/eosMonteCarloEngine.ts` (Layer 0)
- `src/core/eosMonotonicHashChain.ts` (Layer 0)
- `src/mcp/eosMcpServer.ts` (MCP Layer)
- `bin/eos.mjs` (CLI Layer)
