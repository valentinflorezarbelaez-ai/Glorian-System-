# TASKS-197: Threshold Secret Sharing & Ring-LWE Homomorphic Secure Aggregation Engine

## Implementation Tasks (DAG)

- [x] **TASK-197-01**: Record intake in `docs/intake/eos-system/INTAKE-197-POST-QUANTUM-THRESHOLD-MPC.md`.
- [x] **TASK-197-02**: Author change proposal `openspec/changes/CHANGE-197-post-quantum-threshold-mpc.md`.
- [x] **TASK-197-03**: Formalize `openspec/specs/SPEC-335-post-quantum-threshold-mpc.md` (FR-1..6, BDD-1785..1790).
- [x] **TASK-197-04**: Author `docs/plans/PLAN-197-post-quantum-threshold-mpc.md` (ADR-197-001..003).
- [x] **TASK-197-05**: Author this task list.
- [x] **TASK-197-06**: Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-197-07**: Author and TLC-verify TLA+ Model 79 (`ThresholdSecureAggregation.tla` & `.cfg`).
- [x] **TASK-197-08**: Author `src/core/eosPostQuantumThresholdMpc.types.ts`.
- [x] **TASK-197-09**: Implement `src/core/eosPostQuantumThresholdMpc.ts`.
- [x] **TASK-197-10**: Export from `src/core/index.ts` (SPEC-250 compliant).
- [x] **TASK-197-11**: Implement `bin/commands/cliPostQuantumThresholdMpc.mjs` and route `toolchain:pqmpc:`.
- [x] **TASK-197-12**: Catalog 5 commands (598 -> 603, `HYGIENE_GOVERNED`).
- [x] **TASK-197-13**: Author `test/eosPostQuantumThresholdMpc.test.mjs` (BDD-1785..1790).
- [x] **TASK-197-14**: Update coverage budget; run verification.
- [x] **TASK-197-15**: Commit, tip-refresh, seal freeze pin, push through 7-stage gate.
- [x] **TASK-197-16**: Record Engram memory and update walkthrough.
