# CHANGE-089: Monte Carlo Tree Search Policy-Value Mesh (SPEC-204)

- **Change ID**: `CHANGE-089`
- **Spec**: `SPEC-204`
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## Proposed Changes

1. **New Core Engine**:
   - `src/core/eosMctsPolicyValueMesh.ts`:
     - Class `EosMctsPolicyValueMesh`:
       - `search(initialState: MctsState, simulations?: number): MctsSearchResult`
       - `selectAction(rootNode: MctsNode, temperature?: number): string`
       - `expandNode(node: MctsNode): void`
       - `evaluateState(state: MctsState): { priors: Record<string, number>; value: number }`
       - `backpropagate(path: MctsNode[], value: number): void`
       - `extractBestTrajectory(rootNode: MctsNode, maxSteps?: number): MctsTrajectory`
       - `serializeTree(rootNode: MctsNode): SerializedMctsTree`
2. **Package Exports**:
   - Add `"./mcts": "./src/core/eosMctsPolicyValueMesh.ts"` in `package.json`.
   - Export in `src/core/index.ts`.
3. **CLI Commands**:
   - `glorian mcts:search [state] [--simulations=N] [--c-puct=C] [--temp=T] [--json]`
   - `glorian mcts:play [problem]`
   - Alias: `glorian mcts:plan`.
4. **MCP Actions**:
   - `action: "mcts_search"`
   - `action: "mcts_evaluate"`
5. **Testing**:
   - `test/eosMctsPolicyValueMesh.test.mjs` (BDD-1039..BDD-1043).
   - Integration in `test/eosEnterpriseFacade.test.mjs` (step #16).
