# PLAN-090: Autonomous Bounded TLA+ Model Checker & Invariant Synthesizer (SPEC-205)

## Architectural Approach

1. **State Model Representation**:
   - `TlaVariableValuation`: `Record<string, unknown>` (canonical key-sorted object).
   - `TlaState`:
     - `id`: canonical SHA-256 state fingerprint
     - `values`: record of variable names to values
     - `depth`: integer distance from initial state
   - `TlaTransition`:
     - `actionName`: string identifier of action
     - `fromStateId`: origin state fingerprint
     - `toStateId`: destination state fingerprint

2. **Exploration Algorithm**:
   - Breadth-First Search (BFS) starting from initial states evaluated via `model.init()`.
   - Transition relation `model.next(currentState)` yields array of `{ action: string, nextState: TlaVariableValuation }`.
   - Visited states tracked in `Map<string, TlaStateNode>` with parent pointers for counterexample reconstruction.
   - Bounded by `maxDepth` (default: 20) and `maxStates` (default: 5000).

3. **Invariant Engine & Deadlock Detection**:
   - Each invariant predicate `(state: TlaVariableValuation) => boolean` is tested for every reachable state.
   - Deadlock check: if state is not terminal and has 0 legal outgoing transitions, flagged as DEADLOCK.
   - Counterexample reconstruction: backward trace from violated node to root along parent links.

4. **TLA+ Specification Code Generator**:
   - Synthesizes canonical `.tla` syntax:
     ```tla
     ---- MODULE <Name> ----
     EXTENDS Naturals, Sequences, FiniteSets, TLC

     VARIABLES <var1>, <var2>, ...

     Init == ...
     <Action1> == ...
     Next == <Action1> \/ <Action2> ...
     <Invariant1> == ...
     =============================================================================
     ```

5. **Integrations**:
   - Subpath export `"./tla-checker"` in `package.json` and export in `src/core/index.ts`.
   - CLI commands `tla:check` and `tla:synthesize` in `bin/commands/cliPlatform.mjs` & help in `bin/commands/cliKernel.mjs`.
   - MCP actions `tla_check` and `tla_synthesize` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
   - Test suite `test/eosAutonomousTlaModelChecker.test.mjs` (BDD-1044..BDD-1048).
   - Facade test step 17 in `test/eosEnterpriseFacade.test.mjs`.
