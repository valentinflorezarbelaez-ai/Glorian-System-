# INTAKE-154: Live Leslie Lamport TLC Model Checking & Z3 Theorem Prover Wasm Engine

- **Intake ID**: `INTAKE-154`
- **Change ID**: `CHANGE-154`
- **Spec Reference**: `SPEC-292`
- **Target Module**: `src/core/eosZ3WasmProver.ts`
- **Tier**: Formal Verification & Automated SMT Theorem Proving
- **Owner**: `user:valentin-florez-arbelaez`
- **Timestamp**: 2026-11-15T20:52:00Z
- **Status**: `INTAKE_COMPLETE`

---

## 1. Business Need & Context

Glorian System currently maintains 55 formal TLA+ specifications under `docs/formal/`. While `verify:strict` performs bounded JavaScript simulations over extracted ASTs, enterprise hyperscalers and mission-critical financial infrastructures require:

1. **Live Local TLC Model Checking**: Running Leslie Lamport's model checker (`tla2tools.jar`) directly on formal specs when Java runtime is available, detecting state deadlocks and invariant violations.
2. **In-Process SMT Constraint Prover (Z3 Wasm)**: In-process First-Order Logic and Presburger arithmetic theorem prover capable of proving inductive invariants, safety boundaries, and satisfiability without external JVM or heavyweight dependencies (Law V).
3. **Automated Counterexample Synthesis**: Translating TLA+/SMT counterexample state traces into executable BDD test cases that prevent regression.
4. **Cryptographic Proof Receipt**: Emitting `docs/evidence/Z3_PROVER_RECEIPT.json` sealed with SHA-256.

---

## 2. Scope & Technical Objectives

- **Pure Layer-0 TypeScript**: Zero npm runtime packages (`dependencies: {}`).
- **Live TLC Model Checker Runner**: Detects `tla2tools.jar` or `java`, executes TLC on target TLA+ specifications (e.g., `LmaxDisruptor.tla`), and captures model checking states, distinct states, and transition graph metrics.
- **In-Process Z3 SMT Theorem Prover Core**: Evaluates SMT-LIB2 format formulas, propositional horn clauses, and integer linear inequalities (Presburger arithmetic), proving whether conjectures are `UNSAT` (invariant holds universally), `SAT` (counterexample exists), or `UNKNOWN`.
- **Counterexample Trace Translator**: Extracts counterexample variable assignments and generates standard TypeScript/BDD unit test assertions.
- **CLI Subcommands**: `toolchain:z3:prove`, `toolchain:z3:tlc`, `toolchain:z3:audit`.
- **Evidence Receipt**: `docs/evidence/Z3_PROVER_RECEIPT.json`.
