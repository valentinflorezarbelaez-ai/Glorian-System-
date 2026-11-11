# PLAN-086: Layer-0 Hierarchical Navigable Small World (HNSW) Vector Search Engine (SPEC-201)

- **Target**: `src/core/eosHnswVectorIndex.ts`
- **Milestone**: SPEC-201 (v71.0.0)
- **Author**: Valentín Flórez Arbeláez

---

## Technical Approach

1. **Vector Buffer & Distance Primitives**:
   - `Float32Array` buffers for high throughput.
   - Cosine distance: $1 - \frac{u \cdot v}{\|u\|_2 \|v\|_2}$.
   - Euclidean distance: $\sqrt{\sum (u_i - v_i)^2}$.
   - Dot product metric.
2. **HNSW Multi-Layer Graph Architecture**:
   - `HnswNode`: `{ id, vector, level, neighbors: number[][] (per level), metadata }`.
   - Entry point pointer at top layer $L$.
   - Probabilistic level assignment: $l = \lfloor -\ln(\text{unif}(0, 1)) \cdot m_L \rfloor$ where $m_L = 1 / \ln(M)$.
   - Beam search using min/max priority queues.
   - Simple heuristic neighbor selection pruning edges to max degree $M$ ($2M$ at level 0).
3. **Local Deterministic Code Embedding Generator**:
   - Tokenizes code by identifiers, keywords, operators, and 3-character subwords.
   - Computes Murmur3 / SHA-256 hash projections into a $D$-dimensional dense vector.
   - $L_2$-normalizes the projected vector so cosine similarity equals inner product.
4. **Serialization**:
   - Encodes nodes, graph edges, entry point, and hyperparameters into JSON.
   - Restores intact in-memory state.
5. **CLI & MCP Wiring**:
   - `bin/commands/cliPlatform.mjs`: `vector:index`, `vector:search`.
   - `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`: `vector_index`, `vector_search`.
