# CHANGE-132 — TLC Formal Model Checking, Mutation Ratchet Expansion, and Consumer Governance (`SPEC-270`)

## Metadata

- **Change ID**: CHANGE-132
- **Intake Reference**: [INTAKE-132-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET.md](file:///c:/Users/valen/Documents/Glorian-System/docs/intake/eos-system/INTAKE-132-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET.md)
- **Plan Reference**: [PLAN-132-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET.md](file:///c:/Users/valen/Documents/Glorian-System/docs/plans/PLAN-132-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET.md)
- **Tasks Reference**: [TASKS-132-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET.md](file:///c:/Users/valen/Documents/Glorian-System/docs/tasks/TASKS-132-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET.md)
- **Specification**: `SPEC-270` (`BDD-1396`..`BDD-1400`)
- **Status**: APPROVED
- **Authorization**: `AUTH-2026-11-14-TLC-FORMAL-VERIFICATION-AND-MUTATION-RATCHET` (`LEVEL 3`)

## 1. Summary of Changes

1. **Formal TLC Model Checking Engine & Configurations**:
   - Create declarative `.cfg` model configuration files in `docs/formal/` for core protocols:
     - `docs/formal/LmaxDisruptor.cfg`
     - `docs/formal/HermesConsensusMesh.cfg` (extending `FiniteSets`)
     - `docs/formal/DatomicBitemporalLedger.cfg` (extending `TLC`)
     - `docs/formal/AutonomousChaosDisruptor.cfg` (with formal `Next` and `Spec` specification)
   - Implement `scripts/run-tlc.mjs` supporting both local execution (when Java and `tla2tools.jar` are present) and CI deferred execution receipt recording.
   - Implement negative calibration: proving that an injected invariant breach causes TLC to fail with a counterexample state trace.
   - Wire Java 21 + TLC model checking step into `.github/workflows/eos-nightly-deep-gates.yml`.

2. **Mutation Testing Ratchet Expansion**:
   - Add `CUSTOM_TARGET_TEST_MAP` dictionary in `scripts/mutation-gate.mjs` to map arbitrary modules and scripts to test suites.
   - Expand `DEFAULT_TARGETS` and `docs/quality/mutation-budget.json` with governance modules:
     - `src/core/eosContractEvolutionGovernor.ts`
     - `src/core/eosEnterpriseWorkspaceGovernor.ts`
     - `src/core/eosBftAgentSwarmSlashing.ts`
     - `src/core/eosAutonomousTlaModelChecker.ts`
     - `scripts/verify-vercel-function-budget.mjs`
   - Raise and pin mutation floor thresholds.

3. **Module Consumer Governance**:
   - Author `scripts/verify-module-consumers.mjs` to audit internal import linkages across `src/core/` and flag unconsumed specs.
   - Enforce architectural moratorium requiring every future Layer-0 specification to declare active consumers.
