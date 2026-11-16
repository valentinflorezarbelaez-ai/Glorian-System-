# PLAN-154: Live Leslie Lamport TLC Model Checking & Z3 Theorem Prover Wasm Engine

- **Plan ID**: `PLAN-154`
- **Change ID**: `CHANGE-154`
- **Spec Reference**: `SPEC-292`
- **Status**: `APPROVED`
- **Target Module**: `src/core/eosZ3WasmProver.ts`
- **Tier**: Formal Verification & Automated SMT Theorem Proving
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Architectural Strategy

The Live TLC & Z3 Wasm Prover provides multi-tier formal verification across distributed protocols and software invariants.

### Pure Layer-0 Architecture (Law V)

1. **TLC Subprocess Wrapper with Local Graceful Fallback**: Detects presence of Java runtime and `tla2tools.jar`. When present, executes TLC model checker; when absent or in air-gapped CI, falls back to deterministic BFS state-space exploration over declared TLA+ actions.
2. **In-Process Z3 SMT Solver Core**:
   - Implements a pure TypeScript First-Order Logic and Presburger linear arithmetic engine.
   - Evaluates boolean CNF/DNF constraints, integer bounds, and inequality systems via Fourier-Motzkin elimination and branch-and-bound.
   - Computes satisfiability: `SAT` (with model assignments), `UNSAT` (valid negation / proved theorem), or `UNKNOWN`.
3. **Inductive Invariant Prover**:
   - Validates Base Case: $\text{Init}(s) \implies P(s)$ (check $\text{Init}(s) \land \neg P(s)$ is `UNSAT`).
   - Validates Inductive Step: $P(s) \land T(s, s') \implies P(s')$ (check $P(s) \land T(s, s') \land \neg P(s')$ is `UNSAT`).
4. **Counterexample Trace to BDD Synthesizer**: Converts violating assignment models into executable BDD test files under `test/generated/`.
5. **Cryptographic Proof Receipt**: Emits `docs/evidence/Z3_PROVER_RECEIPT.json`.

---

## 2. Component Design & Interfaces

```typescript
export interface TlcExecutionResult {
  specFile: string;
  executionMode: "LIVE_LOCAL_TLC" | "SIMULATED_EXPLORATION";
  generatedStates: number;
  distinctStates: number;
  invariantViolations: number;
  status: "PASS" | "INVARIANT_VIOLATION" | "DEADLOCK";
  counterexampleTrace?: Array<Record<string, any>>;
  durationMs: number;
}

export interface SmtVariable {
  name: string;
  type: "int" | "bool";
  minBound?: number;
  maxBound?: number;
}

export interface SmtConstraint {
  leftVar: string;
  op: "<" | "<=" | ">" | ">=" | "==" | "!=";
  rightVal: number | string;
}

export interface SmtSolveResult {
  status: "SAT" | "UNSAT" | "UNKNOWN";
  model?: Record<string, number | boolean>;
  reason?: string;
}

export interface InductiveProofResult {
  invariantName: string;
  status: "INDUCTIVE_INVARIANT_PROVEN" | "VIOLATION_DETECTED";
  baseCaseProven: boolean;
  inductiveStepProven: boolean;
  counterexample?: Record<string, number | boolean>;
}

export interface Z3ProverAuditReceipt {
  timestampIso: string;
  specRef: "SPEC-292";
  totalTlaSpecsChecked: number;
  totalSmtTheoremsProven: number;
  inductiveInvariantsVerified: number;
  sha256Signature: string;
}
```
