# CHANGE-085: Autonomous Genetic AST Code Synthesizer (SPEC-200 Milestone)

- **Change ID**: `CHANGE-085`
- **Spec**: `SPEC-200`
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## Proposed Changes

1. **New Core Engine**:
   - `src/core/eosGeneticAstSynthesizer.ts`:
     - Class `EosGeneticAstSynthesizer`:
       - `parseAst(code: string): AstNode`
       - `printAst(ast: AstNode): string`
       - `mutateAst(ast: AstNode, operator: MutationOperator, seed?: number): AstNode`
       - `crossoverAst(parentA: AstNode, parentB: AstNode, seed?: number): AstNode`
       - `evaluateFitness(ast: AstNode, testHarness: (code: string) => boolean): number`
       - `synthesize(options: SynthesisOptions): SynthesisResult`
2. **Package Exports**:
   - Add `"./synthesizer": "./src/core/eosGeneticAstSynthesizer.ts"` in `package.json`.
   - Export in `src/core/index.ts`.
3. **CLI Commands**:
   - `glorian synthesize [targetCode] [--generations=N] [--population=N] [--json]`
   - Alias: `glorian ast:synthesize`.
4. **MCP Actions**:
   - `action: "synthesize_code"` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
5. **Testing**:
   - `test/eosGeneticAstSynthesizer.test.mjs` (BDD-1019..BDD-1023).
