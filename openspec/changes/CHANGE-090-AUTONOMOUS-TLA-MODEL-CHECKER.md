# CHANGE-090: Autonomous Bounded TLA+ Model Checker & Invariant Synthesizer (SPEC-205)

- **Change ID**: `CHANGE-090`
- **Spec**: `SPEC-205`
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## Proposed Changes

1. **New Core Engine**:
   - `src/core/eosAutonomousTlaModelChecker.ts`:
     - Class `EosAutonomousTlaModelChecker`:
       - `checkModel(model: TlaModelDefinition, options?: TlaCheckOptions): TlaModelCheckResult`
       - `synthesizeTlaModule(model: TlaModelDefinition): string`
       - `exploreStates(initStates: readonly TlaState[], nextFn: TlaNextFn, options?: TlaCheckOptions): TlaExplorationGraph`
       - `verifyInvariants(states: readonly TlaState[], invariants: readonly TlaInvariant[]): TlaVerificationOutcome`
       - `extractCounterexample(violatingNode: TlaStateNode): readonly TlaTraceStep[]`
2. **Package Exports**:
   - Add `"./tla-checker": "./src/core/eosAutonomousTlaModelChecker.ts"` in `package.json`.
   - Export in `src/core/index.ts`.
3. **CLI Commands**:
   - `glorian tla:check [model_name] [--depth=N] [--json]`
   - `glorian tla:synthesize <model_name> [--output=file] [--json]`
   - Alias: `glorian tla:model-check`.
4. **MCP Actions**:
   - `action: "tla_check"`
   - `action: "tla_synthesize"`
5. **Testing**:
   - `test/eosAutonomousTlaModelChecker.test.mjs` (BDD-1044..BDD-1048).
   - Integration in `test/eosEnterpriseFacade.test.mjs` (step #17).
