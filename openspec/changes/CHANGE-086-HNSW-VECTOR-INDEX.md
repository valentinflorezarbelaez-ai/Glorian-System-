# CHANGE-086: Layer-0 Hierarchical Navigable Small World (HNSW) Vector Search Engine (SPEC-201)

- **Change ID**: `CHANGE-086`
- **Spec**: `SPEC-201`
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## Proposed Changes

1. **New Core Engine**:
   - `src/core/eosHnswVectorIndex.ts`:
     - Class `EosHnswVectorIndex`:
       - `insert(id: string, vector: Float32Array | number[], metadata?: Record<string, unknown>): void`
       - `search(queryVector: Float32Array | number[], k?: number, efSearch?: number): HnswSearchResult[]`
       - `indexCodeSnippet(id: string, code: string, metadata?: Record<string, unknown>): void`
       - `searchCode(query: string, k?: number): HnswSearchResult[]`
       - `embedText(text: string, dimensions?: number): Float32Array`
       - `serialize(): SerializedHnswIndex`
       - `deserialize(data: SerializedHnswIndex): EosHnswVectorIndex`
       - `computeDistance(a: Float32Array, b: Float32Array, metric?: DistanceMetric): number`
2. **Package Exports**:
   - Add `"./vector": "./src/core/eosHnswVectorIndex.ts"` in `package.json`.
   - Export in `src/core/index.ts`.
3. **CLI Commands**:
   - `glorian vector:index <id> <code>`
   - `glorian vector:search <query> [--k=N] [--json]`
   - Alias: `glorian hnsw:search`.
4. **MCP Actions**:
   - `action: "vector_index"`
   - `action: "vector_search"`
5. **Testing**:
   - `test/eosHnswVectorIndex.test.mjs` (BDD-1024..BDD-1028).
