# CHANGE-153: Meta SapFix-Style Closed-Loop Autonomous Healer & Mutation Testing Engine

- **Change ID**: `CHANGE-153`
- **Spec Reference**: `SPEC-291`
- **Status**: `PROPOSED`
- **Target Module**: `src/core/eosSapFixAutoRemediator.ts`
- **Tier**: Autonomous Self-Healing / AST Mutation Testing
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Intent & Architectural Justification

Introduce an industrial closed-loop automated repair and mutation testing engine modeled after Meta's SapFix. The engine evaluates test resilience by systematically mutating source code AST nodes, synthesizing targeted fix candidates when tests fail, and verifying that chosen patches kill surviving mutants without introducing regressions or code coverage drops.

---

## 2. Capabilities & Deliverables

1. `src/core/eosSapFixAutoRemediator.ts`:
   - `AstMutationSaboteur`: Mutates arithmetic, relational, logical, equality, and boolean operators.
   - `MutationRunner`: Runs test assertions against generated mutants, tracking `killedMutants`, `survivingMutants`, and calculating `mutationScore`.
   - `SapFixSynthesizer`: Synthesizes candidate patches for failing expressions or error messages.
   - `ClosedLoopRemediator`: Orchestrates candidate generation, test verification, regression checks, and selects the optimal verified patch.
   - `auditHealingPipeline`: Emits cryptographic SHA-256 sealed receipt to `docs/evidence/SAPFIX_HEAL_RECEIPT.json`.
2. CLI delegation in `bin/commands/cliSapFix.mjs` and `bin/commands/cliDevOps.mjs`:
   - `toolchain:sapfix:mutate`: Runs mutation testing on target files and reports mutation score.
   - `toolchain:sapfix:heal`: Synthesizes and verifies candidate patches for a failing scenario.
   - `toolchain:sapfix:audit`: Audits autonomous healing capabilities and emits cryptographic receipt.
3. Test suite: `test/eosSapFixAutoRemediator.test.mjs` verifying BDD-1521..1526.
