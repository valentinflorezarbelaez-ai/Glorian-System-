# PLAN-085: Autonomous Genetic AST Code Synthesizer (SPEC-200)

- **Target**: `src/core/eosGeneticAstSynthesizer.ts`
- **Milestone**: SPEC-200 (v70.0.0)
- **Author**: Valentín Flórez Arbeláez

---

## Technical Approach

1. **AST Representation**:
   - `AstNode`:
     - `BinaryExpression`: `left`, `operator`, `right` (`+`, `-`, `*`, `/`, `===`, `!==`, `<`, `<=`, `>`, `>=`).
     - `UnaryExpression`: `operator`, `argument` (`!`, `-`, `typeof`).
     - `IfStatement`: `test`, `consequent`, `alternate`.
     - `ReturnStatement`: `argument`.
     - `BlockStatement`: `body: AstNode[]`.
     - `VariableDeclaration`: `name`, `init`.
     - `Identifier`: `name`.
     - `Literal`: `value: number | string | boolean | null`.
2. **Mutation Operators**:
   - `OFF_BY_ONE_REPAIR`: Converts `<` to `<=`, `>` to `>=`, `+ 1` to `- 1` or vice versa.
   - `INVERT_CONDITION`: Inverts equality or comparison (`===` to `!==`, `<` to `>=`).
   - `GUARD_NULL_CHECK`: Wraps access in conditional null guard `if (x != null)`.
   - `SWAP_OPERANDS`: Inverts binary operands (`a - b` to `b - a`).
   - `MUTATE_CONSTANT`: Increments, decrements, or zeroes literals.
   - `REPLACE_OPERATOR`: Replaces arithmetic or logical operator with sibling.
3. **Genetic Crossover**:
   - Slices AST subtrees from parent A and parent B at random or semantic node index.
4. **Fitness Function**:
   - Scores 0 - 100 based on test harness pass rate, AST complexity penalty, and syntactical stability.
5. **Evolution Loop**:
   - Initializes population with seeds and initial mutations.
   - For each generation:
     - Evaluates fitness.
     - Selects top 25% (elitism).
     - Breeds remaining 75% via crossover and mutations.
     - Terminates if fitness reaches 100 or max generations reached.
6. **Diff & Receipt**:
   - Generates unified diff patch showing line changes.
   - Computes deterministic SHA-256 synthesis receipt.
