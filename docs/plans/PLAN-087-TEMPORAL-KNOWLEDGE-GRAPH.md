# PLAN-087: Layer-0 Temporal Knowledge Graph & Datalog Query Engine (SPEC-202)

## Architectural Approach

1. **Storage Subsystem**:
   - Quadruple representation: `(subject: string, predicate: string, object: string, validFrom: number, validTo: number, txTime: number)`.
   - Multi-index architecture:
     - `spoIndex`: `Map<string, Set<number>>` (subject:predicate:object)
     - `posIndex`: `Map<string, Set<number>>` (predicate:object:subject)
     - `ospIndex`: `Map<string, Set<number>>` (object:subject:predicate)
     - `predicateIndex`: `Map<string, Set<number>>`
   - Intervals: default `[0, Infinity]`. `validTo: Infinity` means currently active.

2. **Datalog Evaluation Subsystem**:
   - `DatalogLiteral`: `{ predicate: string, terms: string[] }` (where terms starting with uppercase or `?` are variables, lowercase/quoted are constants).
   - `DatalogRule`: `{ head: DatalogLiteral, body: DatalogLiteral[] }`.
   - Forward Chaining (`T_P` operator):
     - Unifies body literals against existing extensional and intensional facts.
     - Performs variable substitution and projects ground facts into intensional store.
     - Loops until no new ground facts are derived (fixed-point reached).
     - Guard: max iterations (e.g. 100) to prevent runaway non-terminating loops.

3. **Temporal Operations**:
   - `asOf(t)`: filters facts where `validFrom <= t <= validTo`.
   - `during(t1, t2)`: filters facts where `validFrom <= t2 && validTo >= t1`.
   - `findTemporalPath(start, end, rel, asOf)`: BFS pathfinding ensuring each hop is valid at `asOf`.

4. **Integrations**:
   - Subpath export in `package.json` and re-export in `src/core/index.ts`.
   - CLI handlers in `bin/commands/cliPlatform.mjs` and help in `bin/commands/cliKernel.mjs`.
   - MCP actions in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
   - Test suite in `test/eosTemporalKnowledgeGraph.test.mjs`.
   - Facade test case in `test/eosEnterpriseFacade.test.mjs`.
