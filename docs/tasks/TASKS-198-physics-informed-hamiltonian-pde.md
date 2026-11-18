# TASKS-198: Autonomous Physics-Informed Neural Network (PINN) & Symplectic Hamiltonian PDE Integrator

## Implementation Tasks (DAG)

- [x] **TASK-198-01**: Record intake in `docs/intake/eos-system/INTAKE-198-PHYSICS-INFORMED-HAMILTONIAN-PDE.md`.
- [x] **TASK-198-02**: Author change proposal `openspec/changes/CHANGE-198-physics-informed-hamiltonian-pde.md`.
- [x] **TASK-198-03**: Formalize `openspec/specs/SPEC-336-physics-informed-hamiltonian-pde.md` (FR-1..6, BDD-1791..1796).
- [x] **TASK-198-04**: Author `docs/plans/PLAN-198-physics-informed-hamiltonian-pde.md` (ADR-198-001..003).
- [x] **TASK-198-05**: Author this task list.
- [x] **TASK-198-06**: Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **TASK-198-07**: Author and TLC-verify TLA+ Model 80 (`SymplecticHamiltonianPde.tla` & `.cfg`).
- [x] **TASK-198-08**: Author `src/core/eosPhysicsInformedHamiltonianPde.types.ts`.
- [x] **TASK-198-09**: Implement `src/core/eosPhysicsInformedHamiltonianPde.ts`.
- [x] **TASK-198-10**: Export from `src/core/index.ts` (SPEC-250 compliant).
- [x] **TASK-198-11**: Implement `bin/commands/cliPhysicsInformedHamiltonianPde.mjs` and route `toolchain:pinn:`.
- [x] **TASK-198-12**: Catalog 5 commands (603 -> 608, `HYGIENE_GOVERNED`).
- [x] **TASK-198-13**: Author `test/eosPhysicsInformedHamiltonianPde.test.mjs` (BDD-1791..1796).
- [x] **TASK-198-14**: Update coverage budget; run verification.
- [x] **TASK-198-15**: Commit, tip-refresh, seal freeze pin, push through 7-stage gate.
- [x] **TASK-198-16**: Record Engram memory and update walkthrough.
