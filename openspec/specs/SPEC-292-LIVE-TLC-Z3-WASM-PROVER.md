# SPEC-292: Live Leslie Lamport TLC Model Checking & Z3 Theorem Prover Wasm Engine

- **Specification ID**: `SPEC-292`
- **Change ID**: `CHANGE-154`
- **Status**: `APPROVED`
- **Module**: `src/core/eosZ3WasmProver.ts`
- **Tier**: Formal Verification & Automated SMT Theorem Proving
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-292-01 (Event-Driven TLC Model Checking Execution)**: WHEN a formal specification (`.tla`) and configuration (`.cfg`) are submitted, THE SYSTEM SHALL execute Leslie Lamport's TLC Model Checker and extract generated state counts, distinct state counts, and deadlock/invariant status.
- **FR-292-02 (State-Driven TLC Graceful Fallback)**: MIENTRAS Java runtime or `tla2tools.jar` is unavailable in the environment, THE SYSTEM SHALL execute a deterministic in-process state-space exploration simulation and return structured diagnostic results.
- **FR-292-03 (In-Process SMT Theorem Prover)**: WHEN a set of symbolic constraints and invariant assertions is submitted, THE SYSTEM SHALL evaluate their satisfiability using an in-process Presburger and propositional SMT solver returning `SAT`, `UNSAT`, or `UNKNOWN`.
- **FR-292-04 (Inductive Invariant Proving)**: WHEN an initial state predicate $I(s)$ and transition relation $T(s, s')$ are verified against an invariant $P(s)$, THE SYSTEM SHALL prove whether $P$ is inductive by refuting $\neg P(s) \land I(s)$ and $P(s) \land T(s, s') \land \neg P(s')$.
- **FR-292-05 (Counterexample Trace to BDD Synthesis)**: SI an invariant is violated, ENTONCES EL SISTEMA SHALL extract the counterexample trace assignments and synthesize an executable BDD test assertion preventing regressions.
- **FR-292-06 (Cryptographic Proof Receipt)**: WHEN a formal verification audit completes, THE SYSTEM SHALL emit a cryptographic receipt at `docs/evidence/Z3_PROVER_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1527 Live Leslie Lamport TLC Model Checking Execution
  GIVEN a valid TLA+ specification in docs/formal/ (e.g. LmaxDisruptor.tla)
  WHEN EosTlcModelChecker runs TLC evaluation
  THEN it captures generatedStates, distinctStates, and confirms 0 invariant violations
  AND preserves execution status as PASS or SIMULATED_PASS.

SCENARIO: BDD-1528 In-Process SMT Constraint Solving (SAT / UNSAT)
  GIVEN symbolic constraints containing linear integer arithmetic and boolean clauses
  WHEN EosZ3SmtSolver solves the constraint set
  THEN valid formulas (e.g., x > 5 and x < 3) return UNSAT
  AND satisfiable systems return SAT with an assignment model.

SCENARIO: BDD-1529 Inductive Invariant Proving across Transitions
  GIVEN an initial state predicate x >= 0, transition relation x' = x + 1, and invariant x >= 0
  WHEN proveInductiveInvariant is evaluated
  THEN base case and inductive step both refute violations
  AND returns INDUCTIVE_INVARIANT_PROVEN with 0 counterexamples.

SCENARIO: BDD-1530 Invariant Refutation and Counterexample Detection
  GIVEN an invariant x < 10 under transition x' = x + 2 starting at x = 0
  WHEN proveInductiveInvariant is evaluated
  THEN an inductive step violation is detected
  AND a counterexample state with x = 10 is extracted.

SCENARIO: BDD-1531 Counterexample Trace Translation to BDD Test
  GIVEN a counterexample assignment trace from TLC or SMT solver
  WHEN translateCounterexampleToTest is invoked
  THEN it synthesizes a valid TypeScript node:test block
  AND reproduces the exact failing state variables in assertion statements.

SCENARIO: BDD-1532 Cryptographic Z3 Formal Prover Audit Receipt
  GIVEN a formal proof audit executed via toolchain:z3:audit
  WHEN the audit completes
  THEN docs/evidence/Z3_PROVER_RECEIPT.json is written
  AND contains totalTlaSpecsChecked, totalSmtTheoremsProven, inductiveInvariantsVerified, and a valid sha256Signature.
```
