# SPEC-143: Layer-0 Mutation-Testing Engine and Score Ratchet Gate

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

A test suite can be green while asserting almost nothing. `EosMutationTestingEngine` (`src/core/eosMutationTestingEngine.ts`) implements the Google PIT/μTest and Meta SAPIenz pattern cited in the module header: it injects deliberate semantic mutations into a source file and verifies that the suite detects (kills) each mutant. A surviving mutant is a concrete, measurable test gap.

Mutation operators are pattern-based (arithmetic, comparison, logical, boundary, and boolean flips) and the engine generates mutants without the TypeScript Compiler API, keeping the tool dependency-free under Law V. Analysing a mutant means applying it, running the target suite, and treating a failing or erroring suite as a kill; the aggregate of kills over total mutants is the mutation score.

The `scripts/mutation-gate.mjs` wiring makes the score enforceable: mutants are applied inside a throwaway sandbox copy of `src/` and `test/`, so an interrupted run can never corrupt the working tree, and the achieved score is governed by a monotonic ratchet (`docs/quality/mutation-budget.json`) whose per-target floor may only be raised, so test quality can never silently regress.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-521 (Ubiquitous - Operator-Driven Mutant Generation)**: `The system shall generate mutants by applying every registered mutation operator at each valid source position, bounded by the configured per-file mutant cap.`
- **FR-522 (State-Driven - Noise Suppression)**: `While scanning a source file, the system shall skip comment and blank lines so they never produce mutants.`
- **FR-523 (Event-Driven - Mutation Analysis)**: `When a mutant is applied and the test executor runs the target suite, the system shall classify the mutant as killed if the suite fails or errors, and as survived otherwise.`
- **FR-524 (Ubiquitous - Mutation Score and Receipt)**: `The system shall compute the mutation score as the ratio of killed mutants to total mutants and emit a deterministic SHA-256 receipt.`
- **FR-525 (Unwanted Condition - Working Tree Corruption)**: `If mutation analysis executes, then the system shall operate on an isolated sandbox copy of the sources and shall never mutate the working tree.`
- **FR-526 (Unwanted Condition - Score Ratchet Regression)**: `If a target's score falls below its floor, then the system shall raise a violation, and the floor shall only ever be raised, never lowered.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-521 Mutants are generated from arithmetic and comparison operators
GIVEN a small TypeScript fixture containing an addition and a greater-than comparison
WHEN the engine generates mutants for that file
THEN at least two mutants are produced
AND the operator set includes both an arithmetic and a comparison mutation
```

```gherkin
SCENARIO: BDD-522 Full kill scores one hundred percent
GIVEN a fixture whose test executor always reports failure
WHEN the engine analyses the file
THEN no mutant survives
AND the score is one and the percentage reads 100.0 percent
AND a 64-character SHA-256 receipt is emitted
```

```gherkin
SCENARIO: BDD-523 A surviving mutant is flagged as a test gap
GIVEN a fixture whose test executor always reports success
WHEN the engine analyses the file
THEN at least one mutant survives
AND the score is strictly below one
AND each survivor names the operator that produced it
```

```gherkin
SCENARIO: BDD-524 Sandbox isolation and monotonic ratchet
GIVEN a fixture repository with a source file and a budget floor
WHEN the mutation gate runs and a lower score is reported
THEN the working-tree source file is byte-for-byte unchanged
AND the budget floor is not lowered, only raised on improvement
```

---

## 4. Architecture Decision Records (ADRs)

- **ADR-143-1: Pattern-scanning mutation instead of a compiler-based AST rewrite**

  - _Context_: Pulling the TypeScript Compiler API into the generator would add a heavy dependency and break Layer-0 isolation under Law V.
  - _Decision_: Define operators as regular-expression patterns with a replacement function and mutate line by line, deduplicating mutants by line, operator, and offset.
  - _Consequence_: The engine stays dependency-free and fast; the trade-off is that mutations are lexical rather than fully type-aware.

- **ADR-143-2: Isolated sandbox with a monotonic score ratchet**
  - _Context_: Mutating and restoring real source files is unsafe, and a floating mutation score permits silent test-quality regression.
  - _Decision_: Copy `src/`, `test/`, and `package.json` into a temporary sandbox, always restoring the sandbox target after each mutant, and persist a per-target floor that may only increase.
  - _Consequence_: Interrupted runs cannot corrupt working-tree sources and coverage debt cannot grow unnoticed; the trade-off is that raising the floor requires an explicit `--update`.

---

## 5. Atomic Task DAG

1. [x] **TASK-143-1**: Author this specification (EARS requirements, BDD scenarios, ADR) and link it to the module header.
2. [x] **TASK-143-2**: Implement `EosMutationTestingEngine` (`src/core/eosMutationTestingEngine.ts`) with the built-in operators, mutant generation, and scoring.
3. [x] **TASK-143-3**: Implement the `scripts/mutation-gate.mjs` sandbox runner and the monotonic score ratchet.
4. [x] **TASK-143-4**: Add `test/eosMutationTestingEngine.test.mjs` and `test/eosMutationGate.test.mjs` covering every BDD scenario.
