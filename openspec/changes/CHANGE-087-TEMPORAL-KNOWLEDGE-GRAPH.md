# CHANGE-087: Layer-0 Temporal Knowledge Graph & Datalog Query Engine (SPEC-202)

- **Change ID**: `CHANGE-087`
- **Spec**: `SPEC-202`
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## Proposed Changes

1. **New Core Engine**:
   - `src/core/eosTemporalKnowledgeGraph.ts`:
     - Class `EosTemporalKnowledgeGraph`:
       - `assertFact(subject: string, predicate: string, object: string, validFrom?: number, validTo?: number): TemporalFact`
       - `retractFact(subject: string, predicate: string, object: string, timestamp?: number): boolean`
       - `addRule(head: DatalogLiteral, body: DatalogLiteral[]): void`
       - `query(predicate: string, args: (string | null)[], options?: TemporalQueryOptions): readonly DatalogBinding[]`
       - `queryAsOf(timestamp: number, predicate: string, args: (string | null)[]): readonly DatalogBinding[]`
       - `findTemporalPath(startNode: string, endNode: string, relation: string, asOf?: number): readonly string[] | null`
       - `evaluateRules(asOf?: number): DerivationReceipt`
       - `serialize(): SerializedKnowledgeGraph`
       - `deserialize(data: SerializedKnowledgeGraph): EosTemporalKnowledgeGraph`
       - `size(): { facts: number; rules: number; derivedFacts: number }`
2. **Package Exports**:
   - Add `"./knowledge-graph": "./src/core/eosTemporalKnowledgeGraph.ts"` in `package.json`.
   - Export in `src/core/index.ts`.
3. **CLI Commands**:
   - `glorian tkg:assert <s> <p> <o> [--start=T] [--end=T]`
   - `glorian tkg:query <predicate> [args...] [--as-of=T] [--json]`
   - Alias: `glorian graph:datalog`.
4. **MCP Actions**:
   - `action: "tkg_assert"`
   - `action: "tkg_query"`
5. **Testing**:
   - `test/eosTemporalKnowledgeGraph.test.mjs` (BDD-1029..BDD-1033).
   - Integration in `test/eosEnterpriseFacade.test.mjs` (step #14).
