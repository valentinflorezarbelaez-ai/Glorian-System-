# PLAN-211: Architectural Plan for Self-Synthesizing Neural-Symbolic Prover (`SPEC-349`)

- **Change ID**: `CHANGE-211`
- **Spec**: `SPEC-349`
- **Status**: `APPROVED`
- **Lead Architect**: Autonomous Engineering Director (Antigravity / EOS)

---

## 1. Architectural Strategy

The Neural-Symbolic Prover operates as a two-stage hybrid reasoner:

1. **Symbolic Foundation (DPLL / CDCL & Bound Propagation)**:
   - Maintains CNF clauses, 2-watched literals index, trail with decision levels, and non-chronological backjumping.
   - Propagates linear integer interval constraints over transition relations.
2. **Inductive Synthesis (CEGAR Loop)**:
   - Ingests state traces, extracts boundary invariants $a \cdot x + b \cdot y \le c$.
   - Validates Initiation $\text{Init} \implies I$.
   - Tests Consecution $I \land \text{Next} \implies I'$.
   - If consecutive failure occurs with counterexample $\langle s, s' \rangle$, synthesizes separating lemma $\neg s \lor \neg s'$ to refine $I$.
   - Confirms Safety $I \implies \text{Safety}$.

---

## 2. Architecture Decision Records (ADRs)

### ADR-211-001: Pure Layer-0 In-Process CDCL SAT Engine

- **Context**: Need fast, deterministic propositional satisfiability checking without invoking native external solvers (like Z3 or MiniSat binaries) to preserve cross-platform zero-dependency purity.
- **Decision**: Implement a pure TypeScript CDCL solver with unit propagation and clause learning.
- **Consequence**: Guaranteed deterministic execution, zero C++ bindings, runs in V8 and browser environments alike.

### ADR-211-002: Trace-Guided Invariant Induction with CEGAR

- **Context**: Manual specification of inductive loop/protocol invariants is error-prone and brittle.
- **Decision**: Infer candidate invariants from simulation traces and iteratively strengthen them using counterexamples from inductiveness checks.
- **Consequence**: Fully autonomous discovery of inductive invariants for concurrent protocols and loops.
